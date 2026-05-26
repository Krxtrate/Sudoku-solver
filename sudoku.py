class Solution:
    def solveSudoku(self, board):

        rows = [set() for _ in range(9)]
        cols = [set() for _ in range(9)]
        boxes = [set() for _ in range(9)]
        empty = []

        for r in range(9):
            for c in range(9):

                if board[r][c] == ".":
                    empty.append((r, c))

                else:
                    num = board[r][c]

                    rows[r].add(num)
                    cols[c].add(num)
                    boxes[(r // 3) * 3 + (c // 3)].add(num)

        def solve(index):

            if index == len(empty):
                return True

            r, c = empty[index]

            box = (r // 3) * 3 + (c // 3)

            for num in "123456789":

                if (num not in rows[r] and
                    num not in cols[c] and
                    num not in boxes[box]):

                    board[r][c] = num

                    rows[r].add(num)
                    cols[c].add(num)
                    boxes[box].add(num)

                    if solve(index + 1):
                        return True

                    board[r][c] = "."

                    rows[r].remove(num)
                    cols[c].remove(num)
                    boxes[box].remove(num)

            return False

        solve(0)
