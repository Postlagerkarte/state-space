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
        private List<int> possibleIndexLocations;
        private Random r = new Random();


        
        public LevelGeneratorService()
        {
            this.CreatePossibleIndexLocations();
        }

        private void CreatePossibleIndexLocations()
        {
            possibleIndexLocations = Enumerable.Range(9, 54).ToList();
            int[] removeList = new[] { 9, 10, 17, 18, 15, 16, 23, 24, 31, 32, 39, 40, 47, 48 };
            foreach (var key in removeList)
            {
                possibleIndexLocations.Remove(key);
            }

        }

        public BoardViewModel CreateValidBoard()
        {
            var layout = new List<string>();
            for (int x = 0; x < 5; x++)
            {
                layout.Add(Board.KnownPieces.ElementAt(r.Next(Board.KnownPieces.Count())).Key);
            }
            return CreateValidBoard(layout.ToArray());
        }

        public BoardViewModel CreateValidBoard(string[] layout)
        {
            Board board = new Board(layout);
            tryAgain:
            var locations = CreateUnseenLocationArray();
            if (!board.SetUpBoard(locations)) goto tryAgain;

            return this.CreateViewModel(board);
        }

        public BoardViewModel CreateViewModel(Board board)
        {
            TexturePool textures = new TexturePool();
            board.Pieces[0].Texture = @"\Images\Wall_Brown.png";
            board.Pieces[1].Texture = @"\Images\Crate_Black.png";
            board.Pieces.Skip(2).ToList().ForEach(p => p.Texture = @"\Images\" + textures.Get(r.Next(textures.ItemCount)) + ".png");
            return new BoardViewModel(board.Pieces[0], board.Pieces.Skip(1).ToList());
        }

        public void Solve()
        {

        }

        private Dictionary<int, int> hashSet = new Dictionary<int, int>();

        private int[] CreateUnseenLocationArray()
        {
            tryAgain:
            var iArray = new int[7];
            iArray[0] = this.possibleIndexLocations[r.Next(33)];
            iArray[1] = this.possibleIndexLocations[r.Next(33)];
            iArray[2] = this.possibleIndexLocations[r.Next(33)];
            iArray[3] = this.possibleIndexLocations[r.Next(33)];
            iArray[4] = this.possibleIndexLocations[r.Next(33)];
            iArray[5] = this.possibleIndexLocations[r.Next(33)];
            iArray[6] = this.possibleIndexLocations[r.Next(33)];
            int hash = GetHash(iArray);
            if (hashSet.ContainsKey(hash)) goto tryAgain;
            hashSet.Add(hash, hash);

            return iArray;
        }

        private int GetHash(int[] locations)
        {
            var hash = 0;
            var shift = 0;
            int len = locations.Length;
            for (int x = 0; x < len; x++)
            {
                hash ^= (locations[x] << shift);
                shift += 4;
            }
            return hash;
        }

    }
}
