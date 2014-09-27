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
        private bool stopRequest;


        
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

        public Board CreateBoard(Progress<long> progress)
        {
            var layout = new List<string>() { "o" };
            for (int x = 0; x < 6; x++)
            {
                layout.Add(Helper.KnownPieces.ElementAt(r.Next(Helper.KnownPieces.Count())).Key);
            }
            var board = CreateValidBoard(layout.ToArray(), progress);
            return board; 
        }

        public Board CreateValidBoard(string[] layout, IProgress<long> progress)
        {
            long counter = 0;
            Board board = new Board(layout);
            tryAgain:
            counter++;
            if(counter % 100 == 0) progress.Report(counter);
            var locations = CreateUnseenLocationArray(layout.Length);
            if (!board.SetUpBoard(locations)) goto tryAgain;

            return board;
        }

        public BoardViewModel CreateViewModelWithTextures(Board board)
        {
            TexturePool textures = new TexturePool();
            board.Pieces[0].Texture = @"\Images\Wall_Brown.png";
            board.Pieces[1].Texture = @"\Images\Crate_Black.png";
            board.Pieces.Skip(2).ToList().ForEach(p => p.Texture = @"\Images\" + textures.Get(r.Next(textures.ItemCount)) + ".png");
            return new BoardViewModel(board.Pieces[0], board.Pieces.Skip(1).ToList());
        }

        public Board Solve(Board input, IProgress<Tuple<long,long>> progress)
        {
            Dictionary<int, int> hashSet = new Dictionary<int, int>();
            this.stopRequest = false;
            var start = input;

            Board solved = null;
            var todo = new Queue<Board>();
            todo.Enqueue(start);
            var startHash = this.GetHash(start);
            hashSet.Add(startHash, startHash);

            long explored = 0;
            // Keep going as long as there are unseen states...
            while (0 < todo.Count && !stopRequest)
            {


                // Get the next board and process its moves
                var board = todo.Dequeue();
                explored++;
                progress.Report(Tuple.Create(todo.LongCount(), explored));
                foreach (var move in board.GetMoves())
                {
                    if (move.IsSolved)
                    {
                        // Solved!
                        solved = move;
                        todo.Clear();
                        break;
                    }
                    int hash = GetHash(move);
                    if (!hashSet.ContainsKey(hash))
                    {
                        // Enqueue the new state
                        todo.Enqueue(move);
                        hashSet.Add(hash, hash);
                    }
                }
            }

            return solved;
        }

        private int GetHash(Board move)
        {
            int[] locations = new int[move.Pieces.Skip(1).Sum(x => x.Locations.Length)];
            var result = move.Pieces.Skip(1).SelectMany(x => x.Locations).ToArray();
            return GetHash(result);
        }

        private Dictionary<int, int> hashSet = new Dictionary<int, int>();

        private int[] CreateUnseenLocationArray(int size)
        {
            tryAgain:
            var iArray = new int[size];
            iArray[0] = 9; //player piece

            for (int i = 1; i < size; i++)
            {
                iArray[i] = this.possibleIndexLocations[r.Next(33)];
            }

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


        public void StopSolving()
        {
            this.stopRequest = true;
        }
    }
}
