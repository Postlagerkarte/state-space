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
                    new int [2][]  // Rotation
                    { 
                        new[] { 1, 9,  17},
                        new[] { 8, 9,  10}
                    }, 
                    new []{"i2", "i1"}
                    )},

               {"i2", ()=>new BoardPiece(
                new []{1,9,17},
                new int[2][] 
                { 
                    new[] { 8,   9,   10 },
                    new[] { 1, 9,  17}
                },
                new []{"i1", "i2"}
                )},

               {"z1", ()=>new BoardPiece(
                new []{0,1,9,10}, // Location
                new int [2][]  // Rotation
                { 
                    new[] { 1, 8, 9, 16},
                    new[] { 0, 1, 9, 10}
                }, 
                new []{"z2", "z1"}
                )},

               {"z2", ()=>new BoardPiece(
                new []{1,8,9,16}, // Location
                new int [2][]  // Rotation
                { 
                    new[] { 0, 1, 9, 10},
                    new[] { 1, 8, 9, 16}
                }, 
                new []{"z1", "z2"}
                )},

               {"s1", ()=>new BoardPiece(
                new []{1,2,8,9}, // Location
                new int [2][]  // Rotation
                { 
                    new[] { 0, 8, 9, 17},
                    new[] { 1, 2, 8, 9}
                }, 
                new []{"s2", "s1"}
                )},

               {"s2", ()=>new BoardPiece(
                new []{0, 8, 9, 17}, // Location
                new int [2][]  // Rotation
                { 
                    new[] { 1, 2, 8, 9},
                    new[] { 0, 8, 9, 17}
                }, 
                new []{"s1", "s2"}
                )},

                {"t1", ()=>new BoardPiece(
                    new []{8,9,10,17},
                    new int[4][] 
                    { 
                        new[] { 1,9,10,17},
                        new[] { 1,8,9,10},
                        new[] { 1,8,9,17},
                        new[] { 8,9,10,17},

                    },
                    new []{"t2","t3","t4","t1"}
                    )},
                
                {"t2", ()=>new BoardPiece(
                    new []{1,9,10,17},
                      new int[4][] 
                    { 
                        new[] { 1,8,9,10},
                        new[] { 1,8,9,17},
                        new[] { 8,9,10,17},
                        new[] { 1,9,10,17}

                    },
                    new []{"t3","t4","t1","t2"}
                    )},
                
                {"t3", ()=>new BoardPiece(
                    new []{1,8,9,10},
                    new int[4][] 
                    { 
                        new[] { 1,8,9,17},
                        new[] { 8,9,10,17},
                        new[] { 1,9,10,17},
                        new[] { 1,8,9,10},

                    },
                    new []{"t4","t1","t2","t3"}
                    )},
                    
                 {"t4", ()=>new BoardPiece(
                     new []{1,8,9,17},
                     new int[4][] 
                    { 
                        new[] { 8,9,10,17},
                        new[] { 1,9,10,17},
                        new[] { 1,8,9,10},
                        new[] { 1,8,9,17}
                    },
                     new []{"t1","t2","t3","t4"}
                     )},

                 {"j1", ()=>new BoardPiece(
                    new []{0,1,2,10},
                    new int[4][] 
                    { 
                        new[] { 2,10,17,18},
                        new[] { 1,8,9,10},
                        new[] { 0,1,8,16},
                        new[] { 0,1,2,10},

                    },
                    new []{"j2","j3","j4","j1"}
                    )},
                
                {"j2", ()=>new BoardPiece(
                    new []{2,10,17,18},
                      new int[4][] 
                    { 
                        new[] { 0,8,9,10},
                        new[] { 0,1,8,16},
                        new[] { 0,1,2,10},
                        new[] { 2,10,17,18}

                    },
                    new []{"j3","j4","j1","j2"}
                    )},
                
                {"j3", ()=>new BoardPiece(
                    new []{0,8,9,10},
                    new int[4][] 
                    { 
                        new[] { 0,1,8,16},
                        new[] { 0,1,2,10},
                        new[] { 2,10,17,18},
                        new[] { 0,8,9,10},

                    },
                    new []{"j4","j1","j2","j3"}
                    )},
                    
                 {"j4", ()=>new BoardPiece(
                     new []{0,1,8,16},
                     new int[4][] 
                    { 
                        new[] { 0,1,2,10},
                        new[] { 2,10,17,18},
                        new[] { 0,8,9,10},
                        new[] { 0,1,8,16}
                    },
                     new []{"j1","j2","j3","j4"}
                     )},

                 {"l1", ()=>new BoardPiece(
                    new []{0,1,2,8},
                    new int[4][] 
                    { 
                        new[] { 1,2,10,18},
                        new[] { 2,8,9,10},
                        new[] { 0,8,16,17},
                        new[] { 0,1,2,8},

                    },
                    new []{"l2","l3","l4","l1"}
                    )},
                
                {"l2", ()=>new BoardPiece(
                    new []{1,2,10,18},
                      new int[4][] 
                    { 
                        new[] { 2,8,9,10},
                        new[] { 0,8,16,17},
                        new[] { 0,1,2,8},
                        new[] { 1,2,10,18}

                    },
                    new []{"l3","l4","l1","l2"}
                    )},
                
                {"l3", ()=>new BoardPiece(
                    new []{2,8,9,10},
                    new int[4][] 
                    { 
                        new[] { 0,8,16,17},
                        new[] { 0,1,2,8},
                        new[] { 1,2,10,18},
                        new[] { 2,8,9,10},

                    },
                    new []{"l4","l1","l2","l3"}
                    )},
                    
                 {"l4", ()=>new BoardPiece(
                     new []{0,8,16,17},
                     new int[4][] 
                    { 
                        new[] { 0,1,2,8},
                        new[] { 1,2,10,18},
                        new[] { 2,8,9,10},
                        new[] { 0,8,16,17}
                    },
                     new []{"l1","l2","l3","l4"}
                     )},

            {"o", ()=>new BoardPiece(new []{0,1,8,9}, null, null)},



            //{"l1", ()=>new BoardPiece(new []{0,1,2,8})},
            //{"l2", ()=>new BoardPiece(new []{1,2,10,18})},
            //{"l3", ()=>new BoardPiece(new []{2,8,9,10})},
            //{"l4", ()=>new BoardPiece(new []{0,8,16,17})},

        };

    }
}
