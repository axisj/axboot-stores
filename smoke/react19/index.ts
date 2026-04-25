import { useDrawerStore, useModalStore } from '@axboot/stores';

const modalCount: number = useModalStore.getState().modals.size;
const drawerCount: number = useDrawerStore.getState().drawers.size;

if (typeof modalCount !== 'number' || typeof drawerCount !== 'number') {
  throw new Error('Unexpected store shape from @axboot/stores');
}
