import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPersistentToolBarEnabled } from '../../src/config/gameConfig';

describe('isPersistentToolBarEnabled', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockLocationSearch(search: string): void {
    vi.stubGlobal('window', { location: { search } });
  }

  it('is off when window is unavailable', () => {
    vi.stubGlobal('window', undefined);
    expect(isPersistentToolBarEnabled()).toBe(false);
  });

  it('is off by default in the browser', () => {
    mockLocationSearch('');
    expect(isPersistentToolBarEnabled()).toBe(false);
  });

  it('stays off when only global debug=1 is set', () => {
    mockLocationSearch('?debug=1');
    expect(isPersistentToolBarEnabled()).toBe(false);
  });

  it('enables only with debugToolBar=1', () => {
    mockLocationSearch('?debugToolBar=1');
    expect(isPersistentToolBarEnabled()).toBe(true);
  });
});
