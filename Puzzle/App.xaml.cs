using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using System.Linq;
using System.Linq.Expressions;
using System.Reactive;
using System.Reactive.Linq;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;

namespace Puzzle
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : Application
    {
    }



    public class ButtonBehavior
    {
        public static readonly DependencyProperty IndexProperty =
               DependencyProperty.RegisterAttached("Index",
                                                   typeof(int),
                                                   typeof(ButtonBehavior),
                                                   new FrameworkPropertyMetadata(null));

        public static int GetIndex(DependencyObject d)
        {
            return (int)d.GetValue(IndexProperty);
        }

        public static void SetIndex(DependencyObject d, int value)
        {
            d.SetValue(IndexProperty, value);
        }
    }
}
