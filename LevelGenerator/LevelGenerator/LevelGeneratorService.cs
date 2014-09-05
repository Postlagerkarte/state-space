using Common;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace LevelGenerator
{

    public class LevelGeneratorService
    {
        private List<int[]> boardLocationHashStrings = new List<int[]>();
        private List<int> candidates;
        private Board board;
        private Random r = new Random();              
        public LevelGeneratorService()
        {
            candidates = Enumerable.Range(9, 54).ToList();
            int[] removeList = new[] { 15, 16, 23, 24, 31, 32, 39, 40,47,48 };
            foreach (var key in removeList)
            {
                candidates.Remove(key);
            }
            
            board = new Board(new []{"i", "t", "j", "l", "s", "z"});
        }

        public BoardViewModel CreateValidBoard()
        {

            tryAgain:
            var locations = CreateUnseenLocationArray();
            if (!board.SetUpBoard(locations)) goto tryAgain;

            return board.CreateViewModel();
        }

        private Dictionary<int, int> hashSet = new Dictionary<int, int>();

        private int[] CreateUnseenLocationArray()
        {
            tryAgain:
            var iArray = new int[7];
            iArray[0] = this.candidates[r.Next(33)];
            iArray[1] = this.candidates[r.Next(33)];
            iArray[2] = this.candidates[r.Next(33)];
            iArray[3] = this.candidates[r.Next(33)];
            iArray[4] = this.candidates[r.Next(33)];
            iArray[5] = this.candidates[r.Next(33)];
            iArray[6] = this.candidates[r.Next(33)];
            int hash = GetHash(iArray);
            if (hashSet.ContainsKey(hash)) goto tryAgain;
            hashSet.Add(hash, hash);

            return iArray;
        }

        private int GetHash(int[] locations)
        {
            var hash = 0;
            var shift = 0;
            foreach (var i in locations)
            {
                hash ^= (i << shift);
                shift += 4;
            }
            return hash;
        }

    }
}
