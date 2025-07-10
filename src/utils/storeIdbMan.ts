import { IdbStore } from './IdbStore';

export class IdbStoreMan {
  idb: IdbStore;
  name: string;
  version: number;

  constructor(idb: IdbStore, name: string, version: number = 1) {
    this.idb = idb;
    this.name = name;
    this.version = version;
  }

  public async get(key: string) {
    const storageValue: any = await this.idb.get(this.name);

    if (storageValue) {
      return storageValue[key];
    }
  }
  public async set(key: string, value: any) {
    const storageValue: any = await this.idb.get(this.name);

    if (storageValue) {
      storageValue[key] = value;

      await this.idb.set(this.name, storageValue);
    } else {
      await this.idb.set(this.name, { [key]: value });
    }
  }
  public async delete(key: string) {
    const storageValue: any = await this.idb.get(this.name);

    if (storageValue) {
      delete storageValue[key];
      await this.idb.set(this.name, storageValue);
    }
  }
}
