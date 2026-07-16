/// <reference path="../desktop/renderer/global.d.ts" />
// @vitest-environment jsdom

import { act, createElement, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SkillFileList } from '../desktop/renderer/components/SkillLibraryView';
import { SkillSearchFilter } from '../desktop/renderer/components/SkillSearchFilter';
import { createTranslator, detectLocale } from '../desktop/renderer/i18n';
import type {
  SkillPlatformFilter,
  SkillSourceFilter
} from '../desktop/renderer/skillLibraryState';

const t = createTranslator(detectLocale('en-US'));
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('skill filter interactions', () => {
  it('moves focus into the dialog, uses roving radio focus, and restores focus on Escape', () => {
    render(createElement(SkillSearchFilterHarness));
    const filterButton = getButton('Filter skills');

    click(filterButton);

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    let sourceRadios = getRadioButtons('Source');
    expect(document.activeElement).toBe(sourceRadios[0]);
    expect(sourceRadios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1]);

    press(sourceRadios[0], 'ArrowRight');

    sourceRadios = getRadioButtons('Source');
    expect(sourceRadios[1].getAttribute('aria-checked')).toBe('true');
    expect(sourceRadios.map((radio) => radio.tabIndex)).toEqual([-1, 0, -1]);
    expect(document.activeElement).toBe(sourceRadios[1]);

    press(sourceRadios[1], 'End');

    sourceRadios = getRadioButtons('Source');
    expect(sourceRadios[2].getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(sourceRadios[2]);
    expect(getRadioButtons('Platform').map((radio) => radio.tabIndex)).toEqual([0, -1, -1]);

    press(sourceRadios[2], 'Escape');

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(filterButton);
  });
});

describe('virtualized skill file list interactions', () => {
  it('renders all 120 files with complete list position semantics', () => {
    renderFileList('skill-120', makeFiles('file', 120));

    const items = getListItems();
    expect(items).toHaveLength(120);
    expect(items[0].getAttribute('aria-posinset')).toBe('1');
    expect(items[119].getAttribute('aria-posinset')).toBe('120');
    expect(items[119].getAttribute('aria-setsize')).toBe('120');
  });

  it('virtualizes 121 files while exposing the logical total', () => {
    renderFileList('skill-121', makeFiles('file', 121));

    const list = getFileList();
    const items = getListItems();
    expect(items).toHaveLength(23);
    expect(items[0].textContent).toContain('file-0001.md');
    expect(items[0].getAttribute('aria-posinset')).toBe('1');
    expect(items[22].getAttribute('aria-posinset')).toBe('23');
    expect(items[22].getAttribute('aria-setsize')).toBe('121');
    expect(list.getAttribute('aria-label')).toBe('Files 121');
  });

  it('reaches the last of 1001 files and resets scroll when the selected skill changes', () => {
    renderFileList('first-skill', makeFiles('first', 1001));
    const firstList = getFileList();
    firstList.scrollTop = 1001 * 28;

    scroll(firstList);

    let items = getListItems();
    const lastItem = items.at(-1)!;
    expect(lastItem.textContent).toContain('first-1001.md');
    expect(lastItem.getAttribute('aria-posinset')).toBe('1001');
    expect(lastItem.getAttribute('aria-setsize')).toBe('1001');

    renderFileList('second-skill', makeFiles('second', 1001));

    const secondList = getFileList();
    items = getListItems();
    expect(secondList).toBe(firstList);
    expect(secondList.scrollTop).toBe(0);
    expect(items[0].textContent).toContain('second-0001.md');
    expect(items[0].getAttribute('aria-posinset')).toBe('1');
    expect(items[0].getAttribute('aria-setsize')).toBe('1001');
  });
});

function SkillSearchFilterHarness() {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<SkillSourceFilter>('all');
  const [platform, setPlatform] = useState<SkillPlatformFilter>('all');
  return createElement(SkillSearchFilter, {
    platform,
    query,
    source,
    onClear: () => {
      setSource('all');
      setPlatform('all');
    },
    onPlatformChange: setPlatform,
    onQueryChange: setQuery,
    onSourceChange: setSource,
    t
  });
}

function render(element: ReactElement): void {
  act(() => root.render(element));
}

function renderFileList(skillId: string, files: string[]): void {
  render(createElement(SkillFileList, { files, skillId, t }));
}

function getButton(label: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  expect(button).not.toBeNull();
  return button!;
}

function getRadioButtons(label: string): HTMLButtonElement[] {
  const group = container.querySelector(`[role="radiogroup"][aria-label="${label}"]`);
  expect(group).not.toBeNull();
  return Array.from(group!.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
}

function getFileList(): HTMLDivElement {
  const list = container.querySelector<HTMLDivElement>('.skill-file-tree[role="list"]');
  expect(list).not.toBeNull();
  return list!;
}

function getListItems(): HTMLDivElement[] {
  return Array.from(container.querySelectorAll<HTMLDivElement>('[role="listitem"]'));
}

function click(element: HTMLElement): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

function press(element: HTMLElement, key: string): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }));
  });
}

function scroll(element: HTMLElement): void {
  act(() => {
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
}

function makeFiles(prefix: string, count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(4, '0')}.md`
  );
}
