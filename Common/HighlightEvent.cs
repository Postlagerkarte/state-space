using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Common
{
    public class HighlightEvent
    {
        public HighlightEvent(int[] locations)
        {
            Locations = locations;
        }

        public int[] Locations { get; set; }
    }
}
