const modalStore = require('@axboot/stores/dist/commonjs/stores/useModalStore.js');
const drawerStore = require('@axboot/stores/dist/commonjs/stores/useDrawerStore.js');

if (typeof modalStore.useModalStore !== 'function') {
  throw new Error('useModalStore export is missing');
}
if (typeof drawerStore.useDrawerStore !== 'function') {
  throw new Error('useDrawerStore export is missing');
}

console.log('smoke:react19 runtime check passed');
