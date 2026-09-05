import type { MhtsApi } from '../../preload/index';

declare global {
  interface Window {
    mhts: MhtsApi;
  }
}

export {};
