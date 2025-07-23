import { IdbStore } from '../utils';
export const axbootStore = new IdbStore(__APP_NAME__ ?? 'AXBOOT', 'store');
