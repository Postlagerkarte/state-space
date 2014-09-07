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

        public static Dictionary<string, Func<BoardPiece>> KnownPieces = new Dictionary<string, Func<BoardPiece>>()
        {
            {"i", ()=>new BoardPiece(
                new []{8,9,10})},

            {"o", ()=>new BoardPiece(new []{0,1,8,9})},
            {"t1", ()=>new BoardPiece(new []{0,1,2,9})},
            {"t2", ()=>new BoardPiece(new []{1,8,9,10})},
            {"t3", ()=>new BoardPiece(new []{1,9,10,17})},
            {"t4", ()=>new BoardPiece(new []{1,8,9,17})},
            {"j1", ()=>new BoardPiece(new []{0,1,2,10})},
            {"j2", ()=>new BoardPiece(new []{2,10,17,18})},
            {"j3", ()=>new BoardPiece(new []{0,8,9,10})},
            {"j4", ()=>new BoardPiece(new []{0,1,8,16})},
            {"l1", ()=>new BoardPiece(new []{0,1,2,8})},
            {"l2", ()=>new BoardPiece(new []{1,2,10,18})},
            {"l3", ()=>new BoardPiece(new []{2,8,9,10})},
            {"l4", ()=>new BoardPiece(new []{0,8,16,17})},
            {"s1", ()=>new BoardPiece(new []{1,2,8,9})},
            {"s2", ()=>new BoardPiece(new []{0,8,9,17})},
            {"z1", ()=>new BoardPiece(new []{0,1,9,10})},
            {"z2", ()=>new BoardPiece(new []{1,8,9,16})},
        };
        
        private static int[] deltas = new[] { -1, 1, 8, -8 };

        private string[] layout;

        private int[] locations;

        public BoardPiece[] Pieces = new BoardPiece[7];

        public bool SetUpBoard(int[] locations)
        {
       
            this.locations = locations;
            int len = Pieces.Length - 2;
            //move the pieces (excpet player and board) to their desired indexes
            for (int i = 0; i < len; i++)
            {
                this.Pieces[i + 2].MoveToIndex(locations[i]);
            }

            return this.IsValid;
        }


        public Board Parent { get; private set; }

  
        public Board(string[] layout)
        {
            this.layout = layout;
            //create the board, must be the first element in the pieces collection(!)
            var board = new BoardPiece(0, new[] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 15, 16, 23, 24, 31, 32, 39, 40, 47, 48, 55, 56, 57, 58, 59, 60, 61, 62, 63 }, "Wall_Brown");
            this.Pieces[0] = board;

            //create the player piece
            var player = KnownPieces["o"](); //create our player 
            player.MoveToIndex(9); 
            this.Pieces[1] = player;

            //create the other pieces
            int len = Pieces.Length - 2;
            //create the other pieces from the layout
            for (int i = 0; i < len; i++)
            {
               this.Pieces[i + 2] = KnownPieces[layout[i]]();
            }
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
            for(int i=1; i < Pieces.Length; i++)
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
                var occupiedCells = new bool[Helper.BoardWidth * Helper.BoardHeight];

                int len = Pieces.Length;
                // For each piece ...
                    for (int i = 0; i < len; i++)
                    {
                        var index = this.Pieces[i].Index;
                        var offsets = this.Pieces[i].Offsets;
                        //foreach offset inside the piece
                        var max = this.Pieces[i].Offsets.Length;
                        for (int x = 0;x < max; x++)
                        {
                            var location = index + offsets[x];
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
            int len = b.locations.Length;
            for(int x=0; x<len;x++)
            {
                hash ^= (b.locations[x] << shift);
                shift += 4;
            }
            return hash;
        }
    }
}
