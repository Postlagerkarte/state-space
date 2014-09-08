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

        public string Texture { get; set; }
   
        public BoardPiece(int[] offsets, int[][] rotations)
        {
            this.offsets = offsets;
            this.rotations = rotations;
        }

        public BoardPiece(int index, int[] offsets, string texture)
        {
            this.BuildUp(index, offsets);
            this.Texture = texture;
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

        public bool IsInLocation(int index)
        {
            return this.locations.Contains(index);
        }

        public void MoveToIndex(int index)
        {
            this.BuildUp(index, this.offsets);
        }

        int currentRotation = -1;

        public void Rotate()
        {
            currentRotation++;
            this.offsets = this.rotations[currentRotation];
            if (currentRotation == 3) currentRotation = -1;
            this.MoveToIndex(this.Index);
        }

    }
}
