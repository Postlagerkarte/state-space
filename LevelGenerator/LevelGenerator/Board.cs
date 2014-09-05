using Common;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace LevelGenerator
{
  

    public class Board : IEqualityComparer<Board>
    {
        //I: four blocks in a straight line.
        //O: four blocks in a 2×2 square.
        //T: a row of three blocks with one added below the center.
        //J: a row of three blocks with one added below the right side.
        //L: a row of three blocks with one added below the left side.
        //S: two stacked horizontal dominoes with the top one offset to the right.
        //Z: two stacked horizontal dominoes with the top one offset to the left

        private static Dictionary<string, Func<BoardPiece>> KnownPieces = new Dictionary<string, Func<BoardPiece>>()
        {
            {"i", ()=>new BoardPiece(new []{0,1,2,3}, "Crate_Beige")},
            {"o", ()=>new BoardPiece(new []{0,1,8,9}, "Crate_Black")},
            {"t", ()=>new BoardPiece(new []{0,1,2,9}, "Crate_Blue")},
            {"j", ()=>new BoardPiece(new []{0,1,2,10}, "Crate_Brown")},
            {"l", ()=>new BoardPiece(new []{0,1,2,8}, "Crate_Gray")},
            {"s", ()=>new BoardPiece(new []{1,2,8,9}, "Crate_Purple")},
            {"z", ()=>new BoardPiece(new []{0,1,9,10}, "Crate_Red")},
        };
        
        private static int[] deltas = new[] { -1, 1, 8, -8 };

        private string[] layout; 


        private int[] locations;

        private List<BoardPiece> pieces = new List<BoardPiece>();

        public BoardViewModel CreateViewModel()
        {
            this.pieces.ForEach(p => p.Texture = @"\Images\" + p.Texture + ".png");
            return new BoardViewModel(this.pieces[0], this.pieces.Skip(1).ToList());
        }


        public bool SetUpBoard(int[] locations)
        {
            this.pieces.Clear();
            
            this.locations = locations;

            var board = new BoardPiece(0, new[] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 15, 16, 23, 24, 31, 32, 39, 40, 47, 48, 55, 56, 57, 58, 59, 60, 61, 62, 63 }, "Wall_Brown");
            this.pieces.Add(board);

            for (int i = 0; i < layout.Count(); i++)
            {
                var piece = KnownPieces[layout[i]]();
                piece.MoveToIndex(locations[i]);
                this.pieces.Add(piece);
            }

            return this.IsValid;
        }


        public Board Parent { get; private set; }

  
        public Board(string[] layout)
        {
            this.layout = layout;
        }

        // Create a board from its parent
        private Board(Board parent, int[] locations)
        {
            Parent = parent;
            this.SetUpBoard(locations);
        }

        // Get the valid moves from the current board state
        public IEnumerable<Board> GetMoves()
        {
            //Try to move each piece (except for the board)...
            for(int i=1; i<this.pieces.Count; i++)
            {
                 // ... in each direction...
                foreach (var delta in deltas)
                {
                    // ... to create the corresponding board...
                    var locations = (int[])this.locations.Clone();
                    locations[i] += delta;
                    var board = new Board(this, locations);
                    // ... and return it if it's valid
                    if (board.IsValid)
                    {
                        yield return board;
                    }
                 
                }
            }

            // Try to move each piece (except for the board)...
            //for (var p = 0; p < _pieces.Count - 1; p++)
            //{
            //    // ... in each direction...
            //    foreach (var delta in _deltas)
            //    {
            //        // ... to create the corresponding board...
            //        var locations = (int[])_locations.Clone();
            //        locations[p] += delta;
            //        var board = new Board(this, locations);
            //        // ... and return it if it's valid
            //        if (board.IsValid)
            //        {
            //            yield return board;
            //        }
            //    }
            //}
        }

        // Checks whether a board is valid (i.e., has no overlapping cells)
        public bool IsValid
        {
            get
            {
                // Array to track occupied cells
                var occupiedCells = new bool[Helper.BoardWidth * Helper.BoardHeight];
                // For each piece (including the board)...
                foreach(var piece in this.pieces)
                {
                    foreach(var offset in piece.Offsets)
                    {
                        var location = piece.Index + offset;
                        if (occupiedCells[location])
                        {
                            // Already occupied; invalid board
                            return false;
                        }
                        // ... and mark it occupied
                        occupiedCells[location] = true;
                    }
                }

                return true;
            }
        }

        // Checks if the board is solved
        public bool IsSolved
        {
            get
            {
                // All that matters in *this* puzzle is whether the 'A' piece is at its destination
                return (56 == this.locations[0]);
            }
        }

        // Show the board to the user
        //public void Show()
        //{
        //    // Clear the console
        //    Console.Clear();
        //    // For each piece (including the board)...
        //    for (var p = 0; p < _pieces.Count; p++)
        //    {
        //        var piece = _pieces[p];
        //        // ... for each offset...
        //        foreach (var offset in piece.Offsets)
        //        {
        //            // ... determine the x,y of the cell...
        //            var location = _locations[p] + offset;
        //            var x = location % Width;
        //            var y = location / Width;
        //            // ... and plot it on the console
        //            Console.SetCursorPosition(x, y);
        //            Console.Write(piece.Marker);
        //        }
        //    }
        //    // Send the cursor to the bottom and wait for a key
        //    Console.SetCursorPosition(0, Height);
        //    Console.ReadKey();
        //}

        // IEqualityComparer<Board> implemented on this class for convenience

        // Checks if two boards are identical
        public bool Equals(Board x, Board y)
        {
            return Enumerable.SequenceEqual(x.locations, y.locations);
        }

        // Gets a unique-ish hash code for the board
        // XORs the shifted piece locations into an int
        public int GetHashCode(Board b)
        {
            var hash = 0;
            var shift = 0;
            foreach (var i in b.locations)
            {
                hash ^= (i << shift);
                shift += 4;
            }
            return hash;
        }
    }
}
