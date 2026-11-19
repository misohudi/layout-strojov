/** "Verzia 0.1.0 · 28c34cd · 19. 11. 2026" – which build is running (start screen, bottom right). */
export function versionText(version = __APP_VERSION__, commit = __APP_COMMIT__, built = __APP_BUILT__): string {
  const d = new Date(built);
  const date = Number.isNaN(d.getTime()) ? '' : ` · ${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
  return `Verzia ${version} · ${commit}${date}`;
}
