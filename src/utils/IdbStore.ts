interface IdbStoreOptions {
  batchInterval?: number;
  version?: number;
}

export class IdbStore {
  public storeName: string;
  public batchInterval: number;
  public db: Promise<IDBDatabase>;
  private _actions: {
    type: "get" | "set" | "delete";
    key: string;
    value?: any;
    resolve?: (value: any) => void;
    reject?: (error: any) => void;
  }[];
  private _commitPromise: Promise<unknown> | null;

  public constructor(dbName: string, storeName: string, { batchInterval = 10, version = 1 }: IdbStoreOptions = {}) {
    this.storeName = storeName;
    this.batchInterval = batchInterval;

    this.db = new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, version);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        reject(new Error(`error opening the indexedDB database named ${dbName}: ${request.error}`));
      };

      // if db doesn't already exist
      request.onupgradeneeded = () => request.result.createObjectStore(this.storeName);
    });

    this._actions = [];

    // promise for the currently pending commit to the database if it exists
    this._commitPromise = null;
  }

  public async get<T = any>(key: string): Promise<T> {
    const getPromise = new Promise<T>((resolve, reject) => {
      this._actions.push({
        type: "get",
        key,
        resolve,
        reject,
      });
    });

    // reject if the commit fails before the get succeeds
    // to prevent hanging on a failed DB open or other transaction errors
    await Promise.race([getPromise, this._getOrStartCommit()]);

    return getPromise;
  }

  public async set(key: string, value: any) {
    this._actions.push({
      type: "set",
      key,
      value,
    });

    return this._getOrStartCommit();
  }

  public async delete(key: string): Promise<unknown> {
    this._actions.push({
      type: "delete",
      key,
    });

    return this._getOrStartCommit();
  }

  public async destroy(): Promise<any> {
    const db = await this.db;

    // the onsuccess event will only be called after the DB closes
    db.close();

    const request = indexedDB.deleteDatabase(db.name);

    // reject commits after destruction and by extension reject new actions
    this.db = Promise.reject(new Error("This idb-kv instance has been destroyed"));

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve({});
      request.onerror = () => reject(request.error);
    });
  }

  // return the pending commit or a new one if none exists
  private _getOrStartCommit() {
    if (!this._commitPromise) {
      this._commitPromise = this._commit();
    }

    return this._commitPromise;
  }

  // wait for the batchInterval, then commit the queued actions to the database
  private async _commit() {
    // wait batchInterval milliseconds for more actions
    await new Promise((resolve) => setTimeout(resolve, this.batchInterval));

    // the first queue lasts until the db is opened
    const db = await this.db;

    const transaction = db.transaction(this.storeName, "readwrite");
    const store = transaction.objectStore(this.storeName);

    for (const action of this._actions) {
      switch (action.type) {
        case "get": {
          const request = store.get(action.key);
          request.onsuccess = () => action.resolve?.(request.result);
          request.onerror = () => action.reject?.(request.error);
          break;
        }
        case "set": {
          store.put(action.value, action.key);
          break;
        }
        case "delete": {
          store.delete(action.key);
          break;
        }
      }
    }

    // empty queue
    this._actions = [];
    this._commitPromise = null;

    return new Promise((resolve, reject) => {
      // transaction.oncomplete = () => resolve();
      transaction.oncomplete = () => resolve({});

      transaction.onabort = (event) => reject(event);

      transaction.onerror = () => {
        // if aborted, onerror is still called, but transaction.error is null
        if (transaction.error) {
          reject(transaction.error);
        }
      };
    });
  }
}
