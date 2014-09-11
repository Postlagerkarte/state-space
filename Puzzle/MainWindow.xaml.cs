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

        private int currentIndex = -1; //index of the currently selected piece
        
        void gameBoard_PreviewMouseLeftButtonUp(object sender, MouseButtonEventArgs e)
        {
            this.boardViewModel.Drop();
            this.currentIndex = -1;  //user dropped his piece, no piece is selected now!
        }

        void gameBoard_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            e.Handled = true; // otherwise we have no mouse-enter events!

            var element = e.Source as UIElement;
            var x = Grid.GetColumn(element);
            var y = Grid.GetRow(element);
            int currentIndex = Helper.GetIndex(y, x);

            if (this.boardViewModel.CanPieceMove(currentIndex))
            {
                this.boardViewModel.CalculatePossibleMoves(currentIndex);
                this.currentIndex = currentIndex; //store current index
            }
        }

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
                    Grid.SetRow(boardCell, row);
                    Grid.SetColumn(boardCell, column);
                    gameBoard.Children.Add(boardCell);
                }
            }
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
                this.currentIndex = newIndex;
            }
        }
    }
}
