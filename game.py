import random
import tkinter as tk
from dataclasses import dataclass
from typing import List, Optional, Tuple, Set

CELL_SIZE = 28
COLS = 10
ROWS = 20
BOARD_WIDTH = COLS * CELL_SIZE
BOARD_HEIGHT = ROWS * CELL_SIZE

PALETTE = ["#d9b26f", "#a97c50", "#839788", "#bf8f6f", "#9c6b53"]
BG_MAIN = "#111216"
BG_PANEL = "#1b1d24"
BG_GRID = "#161922"
TEXT_MAIN = "#ede8dc"
TEXT_SOFT = "#b3ac9a"
ACCENT = "#c4a678"

SHAPES = [
    [[1, 1, 1, 1]],
    [[1, 1], [1, 1]],
    [[0, 1, 0], [1, 1, 1]],
    [[1, 0, 0], [1, 1, 1]],
    [[0, 0, 1], [1, 1, 1]],
    [[0, 1, 1], [1, 1, 0]],
    [[1, 1, 0], [0, 1, 1]],
]

DIFFICULTIES = {
    "EASY": {"speed": 700, "label": "ゆっくり落下"},
    "NORMAL": {"speed": 500, "label": "標準スピード"},
    "HARD": {"speed": 320, "label": "高速 + 高得点"},
}


@dataclass
class Piece:
    shape: List[List[int]]
    color: str
    x: int
    y: int


class TetrisPuzzleGame:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Noir Blocks: Tetris Puzzle Mix")
        self.root.configure(bg=BG_MAIN)
        self.root.resizable(False, False)

        self.board: List[List[Optional[str]]] = [[None for _ in range(COLS)] for _ in range(ROWS)]
        self.current_piece: Optional[Piece] = None
        self.score = 0
        self.level_name = "NORMAL"
        self.speed = DIFFICULTIES[self.level_name]["speed"]
        self.game_over = False
        self.after_id = None

        self._build_home_screen()

    def _clear_root(self):
        if self.after_id is not None:
            self.root.after_cancel(self.after_id)
            self.after_id = None
        for widget in self.root.winfo_children():
            widget.destroy()

    def _build_home_screen(self):
        self._clear_root()
        container = tk.Frame(self.root, bg=BG_MAIN, padx=40, pady=32)
        container.pack(fill="both", expand=True)

        tk.Label(
            container,
            text="NOIR BLOCKS",
            font=("Helvetica", 30, "bold"),
            fg=TEXT_MAIN,
            bg=BG_MAIN,
        ).pack(pady=(12, 6))

        tk.Label(
            container,
            text="テトリスの落下アクション × 4つ以上つながると消えるパズル要素",
            font=("Helvetica", 11),
            fg=TEXT_SOFT,
            bg=BG_MAIN,
        ).pack(pady=(0, 24))

        panel = tk.Frame(container, bg=BG_PANEL, padx=24, pady=18, highlightbackground="#2f3340", highlightthickness=1)
        panel.pack()

        tk.Label(panel, text="難易度を選択", font=("Helvetica", 14, "bold"), fg=TEXT_MAIN, bg=BG_PANEL).pack(pady=(0, 12))

        for name, cfg in DIFFICULTIES.items():
            btn = tk.Button(
                panel,
                text=f"{name}  -  {cfg['label']}",
                command=lambda n=name: self.start_game(n),
                font=("Helvetica", 11, "bold"),
                width=24,
                bg="#252936",
                fg=TEXT_MAIN,
                activebackground="#32384a",
                activeforeground=TEXT_MAIN,
                bd=0,
                padx=10,
                pady=9,
                cursor="hand2",
            )
            btn.pack(pady=6)

        tk.Label(
            container,
            text="操作: ←→移動 / ↑回転 / ↓高速落下 / Spaceで即落下",
            font=("Helvetica", 10),
            fg=TEXT_SOFT,
            bg=BG_MAIN,
        ).pack(pady=(16, 6))

    def start_game(self, difficulty: str):
        self._clear_root()
        self.level_name = difficulty
        self.speed = DIFFICULTIES[difficulty]["speed"]
        self.score = 0
        self.game_over = False
        self.board = [[None for _ in range(COLS)] for _ in range(ROWS)]

        wrapper = tk.Frame(self.root, bg=BG_MAIN, padx=16, pady=12)
        wrapper.pack(fill="both", expand=True)

        top = tk.Frame(wrapper, bg=BG_MAIN)
        top.pack(fill="x")

        self.score_label = tk.Label(top, text="Score: 0", fg=TEXT_MAIN, bg=BG_MAIN, font=("Helvetica", 13, "bold"))
        self.score_label.pack(side="left")
        self.diff_label = tk.Label(top, text=f"Mode: {difficulty}", fg=ACCENT, bg=BG_MAIN, font=("Helvetica", 11, "bold"))
        self.diff_label.pack(side="right")

        self.canvas = tk.Canvas(wrapper, width=BOARD_WIDTH, height=BOARD_HEIGHT, bg=BG_GRID, highlightthickness=1, highlightbackground="#353a48")
        self.canvas.pack(pady=(10, 0))

        ad = tk.Frame(wrapper, bg="#0f1014", padx=8, pady=8, highlightbackground="#333744", highlightthickness=1)
        ad.pack(fill="x", pady=(10, 2))
        tk.Label(ad, text="Sponsored: Premium Puzzle Pack - 今すぐチェック", bg="#0f1014", fg="#d8d2c5", font=("Helvetica", 10)).pack()

        nav = tk.Frame(wrapper, bg=BG_MAIN)
        nav.pack(fill="x", pady=(10, 0))
        tk.Button(nav, text="ホームへ戻る", command=self._build_home_screen, bg="#252936", fg=TEXT_MAIN, bd=0, padx=10, pady=6).pack(side="left")

        self.root.bind("<Left>", lambda _: self.move_piece(-1, 0))
        self.root.bind("<Right>", lambda _: self.move_piece(1, 0))
        self.root.bind("<Down>", lambda _: self.move_piece(0, 1))
        self.root.bind("<Up>", lambda _: self.rotate_piece())
        self.root.bind("<space>", lambda _: self.hard_drop())

        self.current_piece = self._new_piece()
        self.tick()

    def _new_piece(self) -> Piece:
        shape = random.choice(SHAPES)
        return Piece(shape=shape, color=random.choice(PALETTE), x=COLS // 2 - len(shape[0]) // 2, y=0)

    def _piece_cells(self, piece: Piece) -> List[Tuple[int, int]]:
        cells = []
        for py, row in enumerate(piece.shape):
            for px, val in enumerate(row):
                if val:
                    cells.append((piece.x + px, piece.y + py))
        return cells

    def _valid(self, piece: Piece) -> bool:
        for x, y in self._piece_cells(piece):
            if x < 0 or x >= COLS or y < 0 or y >= ROWS:
                return False
            if self.board[y][x] is not None:
                return False
        return True

    def move_piece(self, dx: int, dy: int):
        if not self.current_piece or self.game_over:
            return
        moved = Piece(self.current_piece.shape, self.current_piece.color, self.current_piece.x + dx, self.current_piece.y + dy)
        if self._valid(moved):
            self.current_piece = moved
            self.draw()
            return
        if dy == 1:
            self.lock_piece()

    def rotate_piece(self):
        if not self.current_piece or self.game_over:
            return
        rotated_shape = [list(row) for row in zip(*self.current_piece.shape[::-1])]
        rotated = Piece(rotated_shape, self.current_piece.color, self.current_piece.x, self.current_piece.y)
        if self._valid(rotated):
            self.current_piece = rotated
            self.draw()

    def hard_drop(self):
        if not self.current_piece or self.game_over:
            return
        while True:
            next_piece = Piece(self.current_piece.shape, self.current_piece.color, self.current_piece.x, self.current_piece.y + 1)
            if self._valid(next_piece):
                self.current_piece = next_piece
            else:
                break
        self.lock_piece()

    def lock_piece(self):
        for x, y in self._piece_cells(self.current_piece):
            if y < 0:
                self.end_game()
                return
            self.board[y][x] = self.current_piece.color

        line_score = self.clear_lines()
        puzzle_score = self.clear_color_clusters()
        self.apply_gravity()

        self.score += line_score + puzzle_score
        self.score_label.config(text=f"Score: {self.score}")

        self.current_piece = self._new_piece()
        if not self._valid(self.current_piece):
            self.end_game()
        self.draw()

    def clear_lines(self) -> int:
        full_rows = [r for r in range(ROWS) if all(self.board[r][c] is not None for c in range(COLS))]
        for r in full_rows:
            del self.board[r]
            self.board.insert(0, [None for _ in range(COLS)])
        return len(full_rows) * 120

    def clear_color_clusters(self) -> int:
        visited: Set[Tuple[int, int]] = set()
        to_clear: Set[Tuple[int, int]] = set()

        for y in range(ROWS):
            for x in range(COLS):
                if self.board[y][x] is None or (x, y) in visited:
                    continue
                color = self.board[y][x]
                stack = [(x, y)]
                group = []
                while stack:
                    cx, cy = stack.pop()
                    if (cx, cy) in visited:
                        continue
                    if not (0 <= cx < COLS and 0 <= cy < ROWS):
                        continue
                    if self.board[cy][cx] != color:
                        continue
                    visited.add((cx, cy))
                    group.append((cx, cy))
                    stack.extend([(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)])

                if len(group) >= 4:
                    to_clear.update(group)

        for x, y in to_clear:
            self.board[y][x] = None

        diff_bonus = {"EASY": 1.0, "NORMAL": 1.2, "HARD": 1.6}[self.level_name]
        return int(len(to_clear) * 18 * diff_bonus)

    def apply_gravity(self):
        for x in range(COLS):
            col = [self.board[y][x] for y in range(ROWS) if self.board[y][x] is not None]
            for y in range(ROWS - 1, -1, -1):
                self.board[y][x] = col.pop() if col else None

    def tick(self):
        if self.game_over:
            return
        self.move_piece(0, 1)
        self.after_id = self.root.after(self.speed, self.tick)

    def draw(self):
        self.canvas.delete("all")
        for y in range(ROWS):
            for x in range(COLS):
                self.canvas.create_rectangle(
                    x * CELL_SIZE,
                    y * CELL_SIZE,
                    (x + 1) * CELL_SIZE,
                    (y + 1) * CELL_SIZE,
                    outline="#222837",
                    width=1,
                    fill=self.board[y][x] if self.board[y][x] else BG_GRID,
                )

        if self.current_piece:
            for x, y in self._piece_cells(self.current_piece):
                if 0 <= y < ROWS:
                    self.canvas.create_rectangle(
                        x * CELL_SIZE,
                        y * CELL_SIZE,
                        (x + 1) * CELL_SIZE,
                        (y + 1) * CELL_SIZE,
                        outline="#e7dcc7",
                        width=1,
                        fill=self.current_piece.color,
                    )

    def end_game(self):
        self.game_over = True
        self.canvas.create_rectangle(60, 220, BOARD_WIDTH - 60, 340, fill="#0f1118", outline="#4d5262", width=2)
        self.canvas.create_text(BOARD_WIDTH // 2, 258, text="GAME OVER", fill=TEXT_MAIN, font=("Helvetica", 22, "bold"))
        self.canvas.create_text(BOARD_WIDTH // 2, 294, text=f"Final Score: {self.score}", fill=TEXT_SOFT, font=("Helvetica", 12))


def main():
    root = tk.Tk()
    app = TetrisPuzzleGame(root)
    root.mainloop()


if __name__ == "__main__":
    main()
