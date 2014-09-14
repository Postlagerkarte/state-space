using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Common
{
    public class RotationEvent
    {
        public RotationEvent(int[] orginalLocations, int[] rotationLocations)
        {
            this.OrginalLocations = orginalLocations;
            this.RotationLocations = rotationLocations;
        }

        public int[] OrginalLocations { get; set; }
        public int[] RotationLocations { get; set; }
    }
}
