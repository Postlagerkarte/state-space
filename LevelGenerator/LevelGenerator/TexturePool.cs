using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace LevelGenerator
{
    public class TexturePool
    {
        private List<string> texturePool =
            new List<string>
            {
                "Crate_Beige",
                "Crate_Blue",
                "Crate_Brown",
                "Crate_Gray",
                "Crate_Purple",
                "Crate_Red",
                "Crate_Yellow",
                "CrateDark_Beige",
                "CrateDark_Blue",
                "CrateDark_Brown",
                "CrateDark_Gray",
                "CrateDark_Purple",
                "CrateDark_Red",
                "CrateDark_Yellow",
            };

        public string Get(int index)
        {
            var result = this.texturePool[index];
            this.texturePool.RemoveAt(index);
            return result;
        }

        public int ItemCount
        {
            get
            {
                return this.texturePool.Count();
            }
        }
    }
}
