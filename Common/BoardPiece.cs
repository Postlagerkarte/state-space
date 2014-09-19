using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Common
{
    public class BoardPiece 
    {
        private int index;
        private int[] offsets;

        public int[] Offsets
        {
            get { return this.offsets; }
        }

        private int[] locations;

        public int[] Locations
        {
            get { return locations; }
        }


        public int Index
        {
            get
            {
                return this.index;
            }
        }

        private int[][] rotations;

        public int[][] Rotations
        {
            get { return rotations; }
        }

        //tuple is: (index-shifting, piece-change)
        private Tuple<int, string>[] transformations;


        public BoardPiece GetPieceForRotation()
        {
            if (CurrentRotation == -1) throw new InvalidOperationException("piece is not rotated.");

            var transformation = this.transformations[this.CurrentRotation];

            var newPiece = Helper.KnownPieces[transformation.Item2]();
            newPiece.Texture = this.Texture;
            newPiece.MoveToIndex(this.index + transformation.Item1);

            return newPiece;
        }

        public string Texture { get; set; }
   
        //used from the level generator, does not need to call BuildUp or pass an index
        //because the level generator always calls movetoindex
        public BoardPiece(int[] offsets, int[][] rotations, Tuple<int,string>[] transformations)
        {
            this.offsets = offsets;
            this.rotations = rotations;
            this.transformations = transformations;
        }

        public BoardPiece(int index, int[] offsets, string texture)
        {
            this.BuildUp(index, offsets);
            this.Texture = texture;
        }

        //used from rotation
        public BoardPiece(int index, int[] offsets, int[][] rotations, string texture)
        {
            this.BuildUp(index, offsets);
            this.Texture = texture;
            this.rotations = rotations;
        }

        private void BuildUp(int index, int[] offsets)
        {
            this.index = index;
            this.offsets = offsets;
            this.locations = new int[offsets.Length];

            int len = offsets.Length;
            for (int x = 0; x < len; x++)
            {
                this.locations[x] = index + offsets[x];
            }
        }

        public bool IsInLocation(int position)
        {
            return this.locations.Contains(position);
        }

        public void MoveToIndex(int index)
        {
            this.BuildUp(index, this.offsets);
        }

        public int CurrentRotation = -1;

        public void Rotate()
        {
            this.CurrentRotation++;
            if (this.CurrentRotation == 4) this.CurrentRotation = 0;
            this.offsets = this.rotations[this.CurrentRotation];
            this.MoveToIndex(this.Index);
        }

        public BoardPiece Clone()
        {
            return (BoardPiece)this.MemberwiseClone();
        }
    }
}
