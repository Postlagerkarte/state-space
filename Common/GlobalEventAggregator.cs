using Reactive.EventAggregator;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Common
{
    public static class GlobalEventAggregator
    {
        public static readonly EventAggregator Current = new EventAggregator();
    }
}
