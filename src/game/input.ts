export type Action = 'left' | 'right' | 'jump' | 'attack' | 'dash';

type KeyMap = Record<string, Action>;

const P1: KeyMap = {
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'jump',
  Space: 'jump',
  KeyJ: 'attack',
  KeyK: 'dash',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'jump',
  KeyZ: 'attack',
  KeyX: 'dash',
};

export class Input {
  private held = new Set<Action>();
  private pressed = new Set<Action>();
  private map: KeyMap;

  constructor(map: KeyMap = P1) {
    this.map = map;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  isDown(action: Action): boolean {
    return this.held.has(action);
  }

  consumePress(action: Action): boolean {
    if (!this.pressed.has(action)) return false;
    this.pressed.delete(action);
    return true;
  }

  endFrame(): void {
    this.pressed.clear();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const action = this.map[e.code];
    if (!action) return;
    if (['Space', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (!this.held.has(action)) this.pressed.add(action);
    this.held.add(action);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const action = this.map[e.code];
    if (!action) return;
    this.held.delete(action);
  };
}
