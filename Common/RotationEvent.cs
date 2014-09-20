using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Common
{
    public class RotationEvent
    {
        public RotationEvent(int[] rotationLocations)
        {
            this.RotationLocations = rotationLocations;
        }

        public int[] RotationLocations { get; set; }
    }
}
