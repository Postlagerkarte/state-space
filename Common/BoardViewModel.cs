using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;


namespace Common
{
    public class BoardViewModel : BindableBase
    {
        private int[] deltas = new int[] { -1, 1, -Helper.BoardWidth, Helper.BoardWidth };
        private List<BoardPiece> pieces = new List<BoardPiece>();
        private List<BoardPiece> simulatedPieces = new List<BoardPiece>();
        private BoardPiece boardLayout;


        public BoardViewModel(BoardPiece boardLayout, List<BoardPiece> pieces)
        {
            this.pieces = pieces;
            this.boardLayout = boardLayout;

            //  9,60,11,41,49,27,33,0

            //pieces.Add(new BoardPiece(9, new[] { 0, 1, 8, 9 }, "game_object_04tl.png", "game_object_04tr.png", "game_object_04bl.png", "game_object_04br.png"));

            //pieces.Add(new BoardPiece(60, new[] { 0, 1, 8, 9 }, "stone_01tl.png", "stone_01tr.png", "stone_01bl.png", "stone_01br.png"));
            //pieces.Add(new BoardPiece(11, new[] { 0, 1, 8, 9 }, "stone_01tl.png", "stone_01tr.png", "stone_01bl.png", "stone_01br.png"));

            //pieces.Add(new BoardPiece(26, new[] { 0, 1, 8, 9 }, ".jpg", "Sand"));

            //pieces.Add(new BoardPiece(41, new[] { 0, 1, 2, 3 }, "wooden_l4_red_1.png", "wooden_l4_red_2.png", "wooden_l4_red_3.png", "wooden_l4_red_4.png"));
            //pieces.Add(new BoardPiece(49, new[] { 0, 1, 2, 3 }, "wooden_l4_green_1.png", "wooden_l4_green_2.png", "wooden_l4_green_3.png", "wooden_l4_green_4.png"));
            //pieces.Add(new BoardPiece(27, new[] { 0, 1, 2, 3 }, "wooden_l4_green_1.png", "wooden_l4_green_2.png", "wooden_l4_green_3.png", "wooden_l4_green_4.png"));
            //pieces.Add(new BoardPiece(33, new[] { 0, 1, 2, 3 }, "wooden_l4_green_1.png", "wooden_l4_green_2.png", "wooden_l4_green_3.png", "wooden_l4_green_4.png"));

            //pieces.Add(new BoardPiece(25, new[] { 0, 8, 16, 24 }, ".jpg", "Sand"));
            //pieces.Add(new BoardPiece(30, new[] { 0, 8, 16, 24 }, ".jpg", "Sand"));

            //var layout =
            //    new BoardPiece(0,
            //        new[] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 15, 16, 23, 24, 31, 32, 39, 40, 47, 48, 55, 56, 63, 64, 71, 72, 73, 74, 75, 76, 77, 78, 79 },
            //        "LightGrass.jpg");
  
            //this.boardLayout = layout;
        }

        public DelegateCommand<Tuple<int,int>> HandleClickCommand
        {
            get { return new DelegateCommand<Tuple<int,int>>(HandleClick);}
        }

        private void HandleClick(Tuple<int,int> obj)
        {
            var index = Helper.GetIndex(obj.Item1, obj.Item2);

            var piece = this.pieces.SingleOrDefault(p => p.IsInLocation(index));

            piece.Rotate();

            this.OnPropertyChanged("Item[]");
        }


        public bool CanMoveToIndex(int index)
        {
            //no if index is occupied by another piece 
            if (this.pieces.Any(p => p.IsInLocation(index))) return false;

            //no if the index is not covered by a simulated move
            if (this.simulatedPieces.None(p => p.IsInLocation(index))) return false;

            return true;
        }


        public void CalculatePossibleMoves(int index)
        {
            var selectedPiece = this.pieces.SingleOrDefault(p => p.IsInLocation(index));

            if (selectedPiece == null) return; //no moveable piece was selected

            var simPieceTexture = @"Images\GroundGravel_Grass.png";

            var simulatedPiece = new BoardPiece(selectedPiece.Index, selectedPiece.Offsets, simPieceTexture);
            this.simulatedPieces.Add(simulatedPiece);
 
            foreach (var delta in this.deltas)
            {
                bool valid = true;
                int i = 1;
                while (valid)
                {
                    simulatedPiece = new BoardPiece(selectedPiece.Index + (delta * i), selectedPiece.Offsets, simPieceTexture);
                    //only add the piece if it is valid
                    valid = IsValidPiece(simulatedPiece, selectedPiece);
                    if (valid)
                    {
                        this.simulatedPieces.Add(simulatedPiece);
                        i++;
                    }
                }
            }
        }

        private bool IsValidPiece(BoardPiece newPiece, BoardPiece selectedPiece)
        {
            bool valid = true;
            foreach (var i in newPiece.Locations)
            {
                //No other piece is allowed at the location. ignore the selected piece.
                //Respect the board layout.
                if (this.pieces.Any(p => p.IsInLocation(i) && p != selectedPiece) ||
                    this.boardLayout.IsInLocation(i))
                {
                    valid = false;
                    break;
                }
            }
            return valid;
        }


        public string this[int row, int column]
        {
            get 
            {
                var index = Helper.GetIndex(row, column);

                if (boardLayout.IsInLocation(index)) return boardLayout.Texture;

                var piece = this.pieces.SingleOrDefault(p => p.IsInLocation(index));

                if(piece != null)
                {
                    return piece.Texture;
                }
               
                piece = this.simulatedPieces.FirstOrDefault(p => p.IsInLocation(index));

                if (piece != null)
                {
                    return piece.Texture;
                }

                return @"Images\GroundGravel_Grass.png";
                
            }
        }

        public bool CanPieceMove(int index)
        {
            return this.pieces.Any(p => p.IsInLocation(index));
        }

        public void PreviewDrop(int oldIndex, int newIndex)
        {
            var piece = this.pieces.SingleOrDefault(p => p.IsInLocation(oldIndex));
            var index = this.simulatedPieces.First(p => p.IsInLocation(newIndex)).Index;
            piece.MoveToIndex(index);
            this.simulatedPieces.Clear();
            this.CalculatePossibleMoves(index);
            this.OnPropertyChanged("Item[]");
        }

        public void Drop()
        {
            this.simulatedPieces.Clear();
            this.OnPropertyChanged("Item[]");
        }
    }   
}
