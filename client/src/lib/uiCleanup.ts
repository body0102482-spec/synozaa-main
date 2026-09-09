/** Reset scroll locks and stray full-screen layers left after modals / mobile drawers. */
export function releaseStuckUiLayers() {
  document.body.style.overflow = '';
  document.body.style.removeProperty('pointer-events');

  for (const node of Array.from(document.body.children)) {
    if (!(node instanceof HTMLElement) || node.id === 'root') continue;

    const style = window.getComputedStyle(node);
    if (style.position !== 'fixed') continue;

    const coversViewport =
      style.top === '0px' &&
      style.right === '0px' &&
      style.bottom === '0px' &&
      style.left === '0px';
    if (!coversViewport) continue;

    const z = Number.parseInt(style.zIndex, 10);
    if (!Number.isFinite(z) || z < 9000) continue;

    const hasDialog = node.querySelector('[role="dialog"], [aria-modal="true"]');
    if (!hasDialog) node.remove();
  }
}
