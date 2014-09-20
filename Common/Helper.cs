using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Common
{
    public static class Helper
    {
        public static int BoardWidth = 8;
        public static int BoardHeight = 8;

        public static int GetIndex(int row, int column)
        {
            return row * BoardWidth + column;
        }

        public static bool None<TSource>(this IEnumerable<TSource> source)
        {
            return !source.Any();
        }

        public static bool None<TSource>(this IEnumerable<TSource> source, Func<TSource, bool> predicate)
        {
            return !source.Any(predicate);
        }


        public static Dictionary<string, Func<BoardPiece>> KnownPieces = new Dictionary<string, Func<BoardPiece>>()
        {
                {"i1", ()=>new BoardPiece(
                    new []{8,9,10}, // Location
                    new int[1][]  // Rotation
                    { 
                        new[] { 1, 9,  17}
                    }, 
                    new Tuple<int,string>[1] //Transformation (index-shifting, piece-changing)
                    {
                        Tuple.Create(0, "i2")
                    }
                    
                    )},

               {"i2", ()=>new BoardPiece(
                new []{1,9,17},
                new int[1][] 
                { 
                    new[] { 8,   9,   10 }
                },
                new Tuple<int,string>[1]
                {
                        Tuple.Create(0, "i1"),
                }
                )},

                {"t1", ()=>new BoardPiece(
                    new []{8,9,10,17},
                    new int[4][] 
                    { 
                        new[] { 1,9,10,17},
                        new[] { 1,8,9,17},
                        new[] { 1,8,9,10},
                        new[] { 1,9,10,17},

                    },
                    null
                    )},
                {"t2", ()=>new BoardPiece(new []{1,8,9,10}, null, null)},
                {"t3", ()=>new BoardPiece(new []{1,9,10,17}, null, null)},
                {"t4", ()=>new BoardPiece(new []{1,8,9,17}, null, null)},

            {"o", ()=>new BoardPiece(new []{0,1,8,9}, null, null)},


            //{"t1", ()=>new BoardPiece(new []{0,1,2,9})},
            //{"t2", ()=>new BoardPiece(new []{1,8,9,10})},
            //{"t3", ()=>new BoardPiece(new []{1,9,10,17})},
            //{"t4", ()=>new BoardPiece(new []{1,8,9,17})},
            //{"j1", ()=>new BoardPiece(new []{0,1,2,10})},
            //{"j2", ()=>new BoardPiece(new []{2,10,17,18})},
            //{"j3", ()=>new BoardPiece(new []{0,8,9,10})},
            //{"j4", ()=>new BoardPiece(new []{0,1,8,16})},
            //{"l1", ()=>new BoardPiece(new []{0,1,2,8})},
            //{"l2", ()=>new BoardPiece(new []{1,2,10,18})},
            //{"l3", ()=>new BoardPiece(new []{2,8,9,10})},
            //{"l4", ()=>new BoardPiece(new []{0,8,16,17})},
            //{"s1", ()=>new BoardPiece(new []{1,2,8,9})},
            //{"s2", ()=>new BoardPiece(new []{0,8,9,17})},
            //{"z1", ()=>new BoardPiece(new []{0,1,9,10})},
            //{"z2", ()=>new BoardPiece(new []{1,8,9,16})},
        };

    }
}
