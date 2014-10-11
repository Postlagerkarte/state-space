using Common;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace LevelGenerator
{
  

    public class Board 
    {

        private bool supportsRotation;

        private static int[] deltas = new[] { -1, 1, 8, -8 };

        private string[] layout;

        private int[] locations;

        public int[] Locations
        {
            get { return locations; }
            set { locations = value; }
        }

        public BoardPiece[] Pieces;


        public bool SetUpBoard(int[] locations)
        {
       
            this.locations = locations;
            int len = Pieces.Length - 1;
            //move the pieces (excpet the board) to their desired indexes
            for (int i = 0; i < len; i++)
            {
                this.Pieces[i + 1].MoveToIndex(locations[i]);
            }

            return this.IsValid;
        }


        public Board Parent { get; private set; }

        public Board()
        {

        }

        public Board(Board parent) : this(parent, parent.locations) { }
  
        public Board(string[] layout)
        {
            this.layout = layout;

            //create piece array: must have one extra slot for the board itself!
            this.Pieces = new BoardPiece[layout.Length + 1];

            //create the board, must be the first element in the pieces collection(!)
            var board = new BoardPiece(0, new[] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 15, 16, 23, 24, 31, 32, 39, 40, 47, 48, 55, 56, 57, 58, 59, 60, 61, 62, 63 }, "Wall_Brown");
            this.Pieces[0] = board;

            //create the other pieces
            int len = Pieces.Length - 1;
            for (int i = 0; i < len; i++)
            {
               this.Pieces[i + 1] = Helper.KnownPieces[layout[i]]();
            }
        }

        // Create a board from its parent
        // if board is coming from a rotation, we need to create a new piece and not only copy pieces
        public Board(Board parent, int[] locations, int i = -1, string pieceName = "")
        {
            Parent = parent;

            this.supportsRotation = parent.supportsRotation;

            this.Pieces = new BoardPiece[parent.Pieces.Count()];

            for (int x = 0; x < parent.Pieces.Count(); x++)
            {
                if (x == i)
                {
                    this.Pieces[x] = Helper.KnownPieces[pieceName]();
                    this.Pieces[x].Texture = parent.Pieces[x].Texture;
                }
                else
                {
                    this.Pieces[x] = parent.Pieces[x].Clone();
                }
            }
                
            this.SetUpBoard(locations);
        }



        // Get the valid moves from the current board state
        public IEnumerable<Board> GetMoves()
        {
            //Try to move each piece (except for the board)...
            for (int i = 1; i < Pieces.Length; i++)
            {
                // ... in each direction...
                foreach (var delta in deltas)
                {
                    // ... to create the corresponding board...
                    var locations = (int[])this.locations.Clone();
                    locations[i - 1] += delta;
                    var board = new Board(this, locations);
                    // ... and return it if it's valid
                    if (board.IsValid)
                    {
                        yield return board;
                    }

                }

                if (this.supportsRotation)
                {

                    if (this.Pieces[i].Transformations != null)
                    {
                        //... and each rotation
                        foreach (var newPiece in this.Pieces[i].Transformations)
                        {
                            var board2 = new Board(this, (int[])this.locations.Clone(), i, newPiece);
                            if (board2.IsValid)
                            {
                                yield return board2;
                            }
                        }
                    }
                }

            }
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
                return (45 == this.locations[0]);
            }
        }
    }
}
