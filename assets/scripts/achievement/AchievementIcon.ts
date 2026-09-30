import { Graphics, Node } from 'cc';
import { color, createLabel, createNode, createRect } from '../common/UiFactory';
import { ACHIEVEMENT_ICONS } from './AchievementIconMap';

const GLYPHS: Readonly<Record<string, string>> = {
  'moon-loop': '☾', flower: '❀', butterfly: '⋈', 'music-snow': '♫', shapes: '◇',
  'crown-ring': '♕', stars: '✦', meteor: '☄', petals: '❀', snow: '❄',
  crystal: '◆', firefly: '✧', seed: '❧', pixel: '▦', 'heart-trail': '♥',
  brush: '✎', palette: '◕', 'pack-pencil': '✎', design: '◇', globe: '◎',
  flask: '⚗', sliders: '☷', hand: '☛', arrows: '⇄', director: '✧',
  archive: '▣', chain: '∞', collection: '▤', medal: '✪', crown: '♛',
  share: '↗', send: '➜', receive: '←', friends: '♧', people: '♧',
  store: '▥', 'gift-heart': '♥', 'leaf-chain': '❧', pencil: '✎',
  journal: '▣', hourglass: '⌛', rain: '☂', 'test-tubes': '⚗', empty: '·',
};

/** Renders the legacy motif assignment and its optional numbered corner badge. */
export function createAchievementIcon(parent: Node, id: string,
  completed: boolean, hidden: boolean, x: number, y: number): Node {
  const [motif, badge] = ACHIEVEMENT_ICONS[id] ?? ['empty'];
  const ink = completed ? '#e0b579' : '#aaa392';
  const icon = createRect('Icon', parent, 72, 72,
    completed ? '#2b241c' : '#1e211f', x, y, 12,
    completed ? '#776044' : '#484740');
  const canvas = createNode('Motif', icon, 44, 44);
  const g = canvas.addComponent(Graphics);
  g.strokeColor = color(ink);
  g.fillColor = color(ink);
  g.lineWidth = 3;
  const line = (...points: number[]): void => {
    g.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) g.lineTo(points[i], points[i + 1]);
    g.stroke();
  };
  switch (motif) {
    case 'ring': case 'crown-ring':
      g.circle(0, 0, 16); g.stroke(); break;
    case 'square':
      g.roundRect(-15, -15, 30, 30, 3); g.stroke(); break;
    case 'smoke':
      g.rect(-19, -11, 35, 7); g.stroke();
      line(-9, -11, -9, -4);
      g.moveTo(8, 0); g.bezierCurveTo(16, 9, 1, 12, 10, 19); g.stroke();
      break;
    case 'door':
      g.rect(-16, -19, 26, 37); g.stroke();
      g.circle(2, -2, 2); g.fill();
      line(13, 0, 19, 0, 15, 5);
      break;
    case 'heart': case 'gift-heart':
      g.moveTo(0, -17);
      g.bezierCurveTo(-30, 0, -18, 20, 0, 9);
      g.bezierCurveTo(18, 20, 30, 0, 0, -17);
      g.fill(); break;
    case 'cloud':
      g.moveTo(-18, -7); g.bezierCurveTo(-22, 4, -14, 9, -6, 7);
      g.bezierCurveTo(-2, 20, 11, 19, 14, 9);
      g.bezierCurveTo(25, 8, 23, -6, 14, -8); g.close(); g.stroke();
      break;
    case 'ticket':
      g.roundRect(-19, -13, 38, 26, 3); g.stroke();
      line(-6, -12, -6, 12); break;
    case 'calendar':
      g.roundRect(-17, -16, 34, 31, 3); g.stroke();
      line(-17, 6, 17, 6); line(-9, 18, -9, 11); line(9, 18, 9, 11);
      break;
    case 'pack': case 'open-pack':
      g.rect(-15, -17, 30, 32); g.stroke();
      line(-15, 7, 15, 7);
      if (motif === 'open-pack') line(-15, 16, -4, 21, 15, 16);
      break;
    case 'leaf': case 'leaf-day':
      g.moveTo(-13, -15); g.bezierCurveTo(-21, 11, 1, 23, 17, 17);
      g.bezierCurveTo(19, 0, 8, -20, -13, -15); g.stroke();
      line(-13, -15, 12, 12); break;
    case 'moon':
      g.moveTo(10, 20); g.bezierCurveTo(-18, 13, -19, -13, 5, -20);
      g.bezierCurveTo(-8, -5, -5, 8, 10, 20); g.fill(); break;
    case 'sunrise':
      line(-20, -12, 20, -12);
      g.arc(0, -12, 12, 0, Math.PI); g.stroke();
      line(0, 7, 0, 18); line(-17, 5, -22, 10); line(17, 5, 22, 10);
      break;
    default:
      createLabel('Glyph', icon, GLYPHS[motif] ?? '✧', 37, ink, 56, 56);
      break;
  }
  if (badge && (!hidden || completed)) {
    const width = Math.max(22, badge.length * 12 + 9);
    createRect('BadgeBackground', icon, width, 20,
      completed ? '#2b241c' : '#1e211f', 30 - width / 2, -28, 4);
    createLabel('Badge', icon, badge, 17, ink, width, 20, 30 - width / 2, -28);
  }
  return icon;
}
