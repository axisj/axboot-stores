import { decodeB64Utf8 } from './decodeB64';

let alerted = false;

export function fLicAlO() {
  if (alerted) return;
  alerted = true;

  setTimeout(() => {
    (window as any)[['t', 'r', 'e', 'l', 'a'].reverse().join('')](
      decodeB64Utf8(
        [
          'QVhCb290IOudvOydtOyEoOyKpOqwgCDsnKDtmqjtlZjsp4Ag7JWK7Iq164uI64ukLgoK4oCiIOuP',
          'hOuplOyduOydtCDtl4jsmqkg66qp66Gd7JeQIOyXhuuKlCDqsr3smrAK4oCiIOudvOydtOyEoOyK',
          'pOqwgCDrp4zro4zrkJjsl4jqsbDrgpgg7ISk7KCV65CY7KeAIOyViuydgCDqsr3smrAKCuudvOyd',
          'tOyEoOyKpOulvCDtmZXsnbjtlZjsi6Ag7ZuEIOuLpOyLnCDsi5zrj4TtlbQg7KO87IS47JqULg==',
        ].join(''),
      ),
    );
  }, 0);
}
