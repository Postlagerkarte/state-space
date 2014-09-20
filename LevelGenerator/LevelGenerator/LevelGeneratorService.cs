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

        public Board CreateBoard()
        {
            var layout = new List<string>() { "o", "t1","t2","t3","t4" };
            //for (int x = 0; x < 5; x++)
            //{
                //layout.Add(Board.KnownPieces.ElementAt(r.Next(Board.KnownPieces.Count())).Key);
            //}
            var board = CreateValidBoard(layout.ToArray());
            return board; 
        }

        public Board CreateValidBoard(string[] layout)
        {
            Board board = new Board(layout);
            tryAgain:
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
            var start = input;

            Board solved = null;
            var seen = new HashSet<Board>(start); // IEqualityComparer<Board>
            var todo = new Queue<Board>();
            todo.Enqueue(start);
            seen.Add(start);

            long explored = 0;
            // Keep going as long as there are unseen states...
            while (0 < todo.Count)
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
                    if (!seen.Contains(move))
                    {
                        // Enqueue the new state
                        todo.Enqueue(move);
                        seen.Add(move);
                    }
                }
            }

            return solved;
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

    }
}
