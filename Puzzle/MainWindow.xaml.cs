using Common;
using LevelGenerator;
using System;
using System.Collections.Generic;
using System.Diagnostics;
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

namespace Puzzle
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        private BoardViewModel boardViewModel;
        private LevelGeneratorService lg = new LevelGeneratorService();
        private Board currentBoard;

        public MainWindow()
        {
            InitializeComponent();

            this.Loaded += MainWindow_Loaded;
        }

        void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            this.gameBoard.PreviewMouseLeftButtonDown += gameBoard_PreviewMouseLeftButtonDown;
            this.gameBoard.PreviewMouseLeftButtonUp += gameBoard_PreviewMouseLeftButtonUp;
        }


        private void Button_Click(object sender, RoutedEventArgs e)
        {
            this.currentBoard = lg.CreateBoard();
            this.boardViewModel = lg.CreateViewModelWithTextures(currentBoard);
            this.Setup(boardViewModel);
        }

        private void Setup(BoardViewModel boardViewModel)
        {
            this.ClearBoard();
            this.CreateGameGrid(boardViewModel);
            boardViewModel.Refresh();
        }

        private void ClearBoard()
        {
            this.gameBoard.Children.Clear();
            this.gameBoard.RowDefinitions.Clear();
            this.gameBoard.ColumnDefinitions.Clear();
        }

        private int currentClickPosition = -1; //index of the currently selected piece
        
        void gameBoard_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            int currentClickPosition = GetCurrentClickPosition(e.Source as UIElement);
            var clickType = (ClickType)e.ClickCount;

            if(clickType == ClickType.SingleClick)
            {
                e.Handled = true; // otherwise we have no mouse-enter events!

                HandleSingleClick(currentClickPosition);
            }
            else if (clickType == ClickType.DoubleClick)
            {
                HandleDoubleClick(currentClickPosition);
            }   
        }

        private void HandleDoubleClick(int currentClickPosition)
        {
            //rotate piece if no rotation is in progess
            if (!this.boardViewModel.IsRotationInProgress)
            {
                this.boardViewModel.Rotate(currentClickPosition);
            }
        }

        private void HandleSingleClick(int currentClickPosition)
        {
            if (boardViewModel.IsRotationInProgress)
            {
                boardViewModel.ConfirmOrCancelRotation(currentClickPosition);
            }
            else
            {
                if (boardViewModel.CanPieceMove(currentClickPosition))
                {
                    boardViewModel.CalculatePossibleMoves(currentClickPosition);
                    boardViewModel.HighlightPiece(currentClickPosition);
                    this.currentClickPosition = currentClickPosition; //store current click position                  
                }
            }
        }

        private int GetCurrentClickPosition(UIElement element)
        {
            var x = Grid.GetColumn(element);
            var y = Grid.GetRow(element);
            int currentClickPosition = Helper.GetIndex(y, x);
            return currentClickPosition;
        }

        void gameBoard_PreviewMouseLeftButtonUp(object sender, MouseButtonEventArgs e)
        {
            this.boardViewModel.Drop();
            this.currentClickPosition = -1;  //user dropped his piece, no piece is selected now!
        }

        private void CreateGameGrid(BoardViewModel boardViewModel)
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
            if (this.currentClickPosition == -1) return;

            var element = e.Source as UIElement;
            var x = Grid.GetColumn(element);
            var y = Grid.GetRow(element);
            int newIndex = Helper.GetIndex(y, x);

            if(this.boardViewModel.CanMoveToPosition(newIndex))
            {
                this.boardViewModel.PreviewDrop(this.currentClickPosition, newIndex);
                this.currentClickPosition = newIndex;
            }
        }

        private async void Button_ClickSolve(object sender, RoutedEventArgs e)
        {

            var progress = new Progress<Tuple<long,long>>(i =>
            {
                this.txtBoardsLeft.Text = i.Item1.ToString();
                this.txtBoardsExplored.Text = i.Item2.ToString();
            });

            var solved = await Task.Run(()=> this.lg.Solve(this.currentBoard, progress));


            // Reverse the solved->start parent chain
            Debug.Assert(null != solved);
            solution = new Stack<Board>();
            while (null != solved)
            {
                solution.Push(solved);
                solved = solved.Parent;
            }

        }

        private Stack<Board> solution;

        private void Button_ClickShowSolution(object sender, RoutedEventArgs e)
        {
             var board = solution.Pop();
            var bvm = new BoardViewModel(board.Pieces[0], board.Pieces.Skip(1).ToList());
            this.Setup(bvm);
            this.boardViewModel = bvm;
        }
    }

    public enum ClickType
    {
        SingleClick = 1,
        DoubleClick = 2
    }
}
