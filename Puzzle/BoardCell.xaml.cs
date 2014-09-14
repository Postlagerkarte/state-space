using Common;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;
using System.Reactive.Linq;

namespace Puzzle
{
    /// <summary>
    /// Interaction logic for GameCell.xaml
    /// </summary>
    public partial class BoardCell : UserControl
    {
        private BoardViewModel ViewModel
        {
            get
            {
                return (BoardViewModel)this.DataContext;
            }
        }


        public BoardCell(object dataContext, int row, int column)
        {
            InitializeComponent();

            this.DataContext = dataContext;

            GlobalEventAggregator.Current.GetEvent<RotationEvent>()
                .Subscribe(e=>
            {
                var cellLocation = Helper.GetIndex(row, column);

                VisualStateManager.GoToState(this, "Default", false);

                if (e.RotationLocations.Contains(cellLocation))
                {
                    VisualStateManager.GoToState(this, "Blink", false);
                    return;
                }

                if (e.OrginalLocations.Contains(cellLocation))
                {
                    VisualStateManager.GoToState(this, "LowOpacity", false);
                    return;
                }

               
            });

            
            //GlobalEventAggregator.Current.GetEvent<RotationEvent>().Where(x=> Subscribe<RotationEvent>(e =>
            //    {
            //        if (e.RotatedIndex == Helper.GetIndex(row, column))
            //        {
            //            VisualStateManager.GoToState(myCanvas, "Blink", false);
            //        }
            //        else
            //        {
            //            VisualStateManager.GoToState(myCanvas, "Default", false);
            //        }
            //    });

            // this calls into the data context indexer (which is boardviewmodel)
            // and returns the appropriate image for the cell
            myCanvas.SetBinding(Button.TagProperty,
                new Binding { Path = new PropertyPath(String.Format("[{0},{1}]", row, column)) });

            //myCanvas.SetBinding(Button.CommandProperty, new Binding { Path = new PropertyPath("HandleClickCommand") });
            //myCanvas.CommandParameter = new Tuple<int, int>(row, column);

            //var mouseBinding = new MouseBinding();
            //mouseBinding.Gesture = new MouseGesture(MouseAction.LeftDoubleClick);
            //mouseBinding.Command = this.ViewModel.RotateCommand;
            //mouseBinding.CommandParameter = new Tuple<int, int>(row, column);
            //myCanvas.InputBindings.Add(mouseBinding);


            //this.Tag = new Tuple<int, int>(row, column);

            //dbg.Text = Helper.GetIndex(row, column).ToString();
           
        }

    }
}
