using Common;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reactive;
using System.Reactive.Linq;
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

            myCanvas.SetBinding(Button.TagProperty,
                new Binding { Path = new PropertyPath(String.Format("[{0},{1}]", row, column)) });
            //myCanvas.SetBinding(Button.CommandProperty, new Binding { Path = new PropertyPath("HandleClickCommand") });
            myCanvas.CommandParameter = new Tuple<int, int>(row, column);

            var mouseBinding = new MouseBinding();
            mouseBinding.Gesture = new MouseGesture(MouseAction.LeftDoubleClick);
            mouseBinding.Command = this.ViewModel.HandleClickCommand;
            mouseBinding.CommandParameter = new Tuple<int, int>(row, column);
            myCanvas.InputBindings.Add(mouseBinding);


            this.Tag = new Tuple<int, int>(row, column);
            ButtonBehavior.SetIndex(myCanvas, Helper.GetIndex(row, column));
            //dbg.Text = Helper.GetIndex(row, column).ToString();


            myCanvas.ObserveBeginMouseDrag().Subscribe(e =>
                {
                    var index = Helper.GetIndex(row, column);
                    if (!this.ViewModel.CanPieceMove(index)) return;
                    this.ViewModel.CalculatePossibleMoves(index);

                    var dragData = new DataObject("oldIndex", index);
                    DragDrop.DoDragDrop(myCanvas, dragData, DragDropEffects.Move);
                });

            myCanvas.ObservePreviewDragOver().Subscribe(ev =>
             {
                 var newIndex = ButtonBehavior.GetIndex((Button)ev.Sender);

                 if(!this.ViewModel.CanMoveToIndex(newIndex))
                 {
                     ev.EventArgs.Handled = true;
                     return;
                 }

                 var oldIndex = (int)ev.EventArgs.Data.GetData("oldIndex");

                 this.ViewModel.PreviewDrop(oldIndex, newIndex);

                 ev.EventArgs.Data.SetData("oldIndex", newIndex);

                 var canDrop = ev.EventArgs.Data.GetDataPresent("myDragData");
                 ev.EventArgs.Effects = canDrop ? DragDropEffects.Move : DragDropEffects.None;
                 ev.EventArgs.Handled = canDrop;
                 

             });

            myCanvas.ObservePreviewDrop().Subscribe(e => 
            {
                this.ViewModel.Drop();
            });

           
        }

    }
}
