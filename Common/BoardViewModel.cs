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
        }

        public void MoveToIndex(int newIndex, int oldIndex)
        {
            this.pieces.Single(p => p.IsInLocation(oldIndex)).MoveToIndex(newIndex);
            this.OnPropertyChanged("Item[]");
        }

        public bool CanMoveToPosition(int position)
        {
            //no if index is occupied by another piece 
            if (this.pieces.Any(p => p.IsInLocation(position))) return false;

            //no if the index is not covered by a simulated move
            if (this.simulatedPieces.None(p => p.IsInLocation(position))) return false;

            return true;
        }

        public void CalculatePossibleMoves(BoardPiece selectedPiece)
        {
            this.simulatedPieces.Clear();

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

        public void CalculatePossibleMoves(int currentIndex)
        {
            var selectedPiece = this.pieces.SingleOrDefault(p => p.IsInLocation(currentIndex));

            if (selectedPiece == null) throw new InvalidOperationException("No moveable piece selected");

            this.CalculatePossibleMoves(selectedPiece);
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

                //Asking for board image?
                if (boardLayout.IsInLocation(index)) return boardLayout.Texture;

                //Asking for board piece image?
                var piece = this.pieces.SingleOrDefault(p => p.IsInLocation(index));

                if(piece != null)
                {
                    return piece.Texture;
                }
               
                //Asking for simulated move image?
                piece = this.simulatedPieces.FirstOrDefault(p => p.IsInLocation(index));

                if (piece != null)
                {
                    return piece.Texture;
                }


                //Asking for unused cell image?
                return @"Images\GroundGravel_Grass.png";
                
            }
        }

        public bool CanPieceMove(int index)
        {
            return this.pieces.Any(p => p.IsInLocation(index));
        }

        public void PreviewDrop(int currentIndex, int newIndex)
        {
                var piece = this.pieces.SingleOrDefault(p => p.IsInLocation(currentIndex));
                var index = this.simulatedPieces.First(p => p.IsInLocation(newIndex)).Index;
                piece.MoveToIndex(index);

                this.CalculatePossibleMoves(piece);

                this.OnPropertyChanged("Item[]");          
        }

        public void Drop()
        {
            this.simulatedPieces.Clear();
            this.OnPropertyChanged("Item[]");
        }

        public void Rotate(int currentClickPosition)
        {
            var piece = this.pieces.SingleOrDefault(p => p.IsInLocation(currentClickPosition));
            rotateAgain:
            piece.Rotate();
            if (!IsValidRotationPosition(piece)) goto rotateAgain;
            GlobalEventAggregator.Current.Publish(new RotationEvent(piece.Locations));
            this.Refresh();
        }

        private bool IsValidRotationPosition(BoardPiece piece)
        {
            //no if piece is not inside the board layout
            if (piece.Locations.Any(l => this.boardLayout.Locations.Contains(l))) return false;

            //no if another piece is occuping the position 
            foreach (var p in pieces)
            {
                if (p.GetHashCode() == piece.GetHashCode()) continue;//(ignore piece itself)
                if (p.Locations.Any(l => piece.Locations.Contains(l))) return false;
            }

            return true;
        }


        public BoardPiece GetPiece(int index)
        {
            return this.pieces.Single(p => p.Index == index);
        }

        public void Refresh()
        {
            this.OnPropertyChanged("Item[]");
        }

        public void HighlightPiece(int currentClickPosition)
        {
            var piece = this.pieces.SingleOrDefault(p => p.IsInLocation(currentClickPosition));
            GlobalEventAggregator.Current.Publish(new HighlightEvent(piece.Locations));
        }
    } 
}