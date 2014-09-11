using Common;
using LevelGenerator;
using System;
using System.Collections.Generic;
using System.Linq;
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
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        private BoardViewModel boardViewModel;

        public MainWindow()
        {
            InitializeComponent();
        }

        LevelGeneratorService levelGenerator = new LevelGeneratorService();

        private void Button_Click(object sender, RoutedEventArgs e)
        {

            var boardViewModel = levelGenerator.CreateValidBoard();
            this.boardViewModel = boardViewModel;
            this.ClearBoard();
            this.CreateBoard(boardViewModel);
            this.gameBoard.PreviewMouseLeftButtonDown += gameBoard_PreviewMouseLeftButtonDown;
            this.gameBoard.PreviewMouseLeftButtonUp += gameBoard_PreviewMouseLeftButtonUp;
        
        }

        private void ClearBoard()
        {
            this.gameBoard.Children.Clear();
            this.gameBoard.RowDefinitions.Clear();
            this.gameBoard.ColumnDefinitions.Clear();
        }

        void gameBoard_PreviewMouseLeftButtonUp(object sender, MouseButtonEventArgs e)
        {
            this.currentIndex = -1;  //no piece is selected
        }

        private int currentIndex = -1;

        private int newIndex;

        //void gameBoard_MouseMove(object sender, MouseEventArgs e)
        //{
        //    if (this.SelectedPieceIndex == -1) return;
        //    this.gameBoard.MouseMove -= gameBoard_MouseMove;

        //    var position = e.GetPosition(gameBoard);
        //    var rowcol = GetRowCol(position);
        //    newIndex = Helper.GetIndex(rowcol.Item1, rowcol.Item2);

        //    if(newIndex != this.SelectedPieceIndex)
        //    {         
        //        this.boardViewModel.PreviewDrop(this.SelectedPieceIndex, newIndex);
        //    }
        //    this.gameBoard.MouseMove += gameBoard_MouseMove;
        //}

        void gameBoard_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            e.Handled = true;

            var element = e.Source as UIElement;
            var x = Grid.GetColumn(element);
            var y = Grid.GetRow(element);
            int index = Helper.GetIndex(y, x);

            if (this.boardViewModel.CanPieceMove(index))
            {
                this.boardViewModel.CalculatePossibleMoves(index);
                this.currentIndex = index;
            }
        }

        //public Tuple<int,int> GetRowCol(Point position)
        //{
        //    double start = 0.0;
        //    int row = 0;
        //    foreach (RowDefinition rd in this.gameBoard.RowDefinitions)
        //    {
        //        start += rd.ActualHeight;
        //        if (position.Y < start)
        //        {
        //            break;
        //        }
        //        row++;
        //    }

        //    double start2 = 0.0;
        //    int col = 0;
        //    foreach (var rd in this.gameBoard.ColumnDefinitions)
        //    {
        //        start2 += rd.ActualWidth;
        //        if (position.X < start2)
        //        {
        //            break;
        //        }
        //        col++;
        //    }

        //    return new Tuple<int, int>(row, col);
        //}




        private void CreateBoard(BoardViewModel boardViewModel)
        {
            var rows = Enumerable.Range(0, Helper.BoardHeight).ToArray();
            var columns = Enumerable.Range(0, Helper.BoardWidth).ToArray();

            foreach (var row in rows) gameBoard.RowDefinitions.Add(new RowDefinition());
            foreach (var column in columns) gameBoard.ColumnDefinitions.Add(new ColumnDefinition());

            foreach (var row in rows)
            {
                foreach (var column in columns)
                {
                    var boardCell = new BoardCell(boardViewModel, row, column);
                    boardCell.MouseEnter += boardCell_MouseEnter;
                    boardCell.MouseLeave += boardCell_MouseLeave;
                    Grid.SetRow(boardCell, row);
                    Grid.SetColumn(boardCell, column);
                    gameBoard.Children.Add(boardCell);
                }
            }
        }

        void boardCell_MouseLeave(object sender, MouseEventArgs e)
        {
            
        }

        void boardCell_MouseEnter(object sender, MouseEventArgs e)
        {
            if (this.currentIndex == -1) return;

            var element = e.Source as UIElement;
            var x = Grid.GetColumn(element);
            var y = Grid.GetRow(element);
            int newIndex = Helper.GetIndex(y, x);

            if(this.boardViewModel.CanMoveToIndex(newIndex))
            {
                this.boardViewModel.PreviewDrop(this.currentIndex, newIndex);
                //this.boardViewModel.MoveToIndex(newIndex, currentIndex);
                //this.boardViewModel.CalculatePossibleMoves(newIndex);
                this.currentIndex = newIndex;
            }
        }
    }
}
