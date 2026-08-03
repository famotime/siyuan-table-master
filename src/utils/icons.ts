/**
 * Lucide-style SVG icons for HTML Table Editor UI
 */

function makeSvg(pathD: string, extraAttrs = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="at-lucide-icon"${extraAttrs}>${pathD}</svg>`;
}

export const icons = {
  import: makeSvg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m10 13-3 3 3 3"/><path d="M7 16h10"/>'),
  copy: makeSvg('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'),
  undo: makeSvg('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>'),
  redo: makeSvg('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>'),
  selectAll: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2" stroke-dasharray="3 3"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>'),
  caption: makeSvg('<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/>'),
  addRow: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 15h6"/><path d="M12 12v6"/>'),
  addCol: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M12 12h6"/><path d="M15 9v6"/>'),
  insertRowAbove: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 15h18"/><path d="M9 7h6"/><path d="M12 4v6"/>'),
  insertRowBelow: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 15h6"/><path d="M12 12v6"/>'),
  insertColLeft: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="M6 12h6"/><path d="M9 9v6"/>'),
  insertColRight: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M12 12h6"/><path d="M15 9v6"/>'),
  deleteRow: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 10h18"/><path d="M12 16h4"/>'),
  deleteCol: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M10 3v18"/><path d="M14 12h4"/>'),
  moveRowUp: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 14h18"/><path d="m10 10 2-2 2 2"/>'),
  moveRowDown: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 10h18"/><path d="m14 14-2 2-2-2"/>'),
  moveColLeft: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M14 3v18"/><path d="m10 14-2-2 2-2"/>'),
  moveColRight: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M10 3v18"/><path d="m14 10 2 2-2 2"/>'),
  merge: makeSvg('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><path d="M12 8v8"/><path d="m9 11 3-3 3 3"/><path d="m9 13 3 3 3-3"/>'),
  split: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/><path d="M3 12h18"/>'),
  alignLeft: makeSvg('<line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/>'),
  alignCenter: makeSvg('<line x1="21" x2="3" y1="6" y2="6"/><line x1="17" x2="7" y1="12" y2="12"/><line x1="19" x2="5" y1="18" y2="18"/>'),
  alignRight: makeSvg('<line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="9" y1="12" y2="12"/><line x1="21" x2="7" y1="18" y2="18"/>'),
  alignTop: makeSvg('<path d="M4 4h16"/><path d="M7 8v12"/><path d="M17 8v8"/><path d="M12 8v10"/>'),
  alignMiddle: makeSvg('<path d="M4 12h16"/><path d="M8 6v12"/><path d="M16 8v8"/>'),
  alignBottom: makeSvg('<path d="M4 20h16"/><path d="M7 4v12"/><path d="M17 8v8"/><path d="M12 6v10"/>'),
  bgColor: makeSvg('<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>'),
  textColor: makeSvg('<path d="M4 20h16"/><path d="m6 16 6-12 6 12"/><path d="M8 12h8"/>'),
  textBg: makeSvg('<path d="m9 11-6 6v3h3l6-6"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/><path d="M18 2 22 6"/>'),
  clear: makeSvg('<path d="m7 21 10-10"/><path d="M20 6 9 17l-5-5L15 1z"/><path d="M18 13l3 3"/><path d="M3 21h18"/>'),
  minus: makeSvg('<line x1="5" x2="19" y1="12" y2="12"/>'),
  plus: makeSvg('<line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>'),
  zoomIn: makeSvg('<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/>'),
  zoomOut: makeSvg('<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/>'),
  fit: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/>'),
  resetZoom: makeSvg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
  fontSize: makeSvg('<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>'),
  lineHeight: makeSvg('<polyline points="4 8 8 4 12 8"/><polyline points="4 16 8 20 12 16"/><line x1="8" x2="8" y1="4" y2="20"/><line x1="16" x2="22" y1="6" y2="6"/><line x1="16" x2="22" y1="12" y2="12"/><line x1="16" x2="22" y1="18" y2="18"/>'),
  border: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 3v18"/>'),
  padding: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2"/><rect width="10" height="10" x="7" y="7" rx="1" stroke-dasharray="2 2"/>'),
  chevronLeft: makeSvg('<path d="m15 18-6-6 6-6"/>'),
  chevronRight: makeSvg('<path d="m9 18 6-6-6-6"/>'),
  panelRightClose: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m8 9 3 3-3 3"/>'),
  panelRightOpen: makeSvg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m11 9-3 3 3 3"/>'),
};
