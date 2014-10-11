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
        private int[] cachedLocations;
        private bool allowRotation;

        private Stack<Board> cachedSolution; //So that we can reset and show the solution again
        private Stack<Board> solution; //used to popup each moves and display it to the user

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


        private async void Button_ClickCreateBoard(object sender, RoutedEventArgs e)
        {
            await CreateBoard();
        }

        private async Task CreateBoard()
        {
            this.ClearText();

            var numberOfPieces = (int)pieceSlider.Value;
            var progress = new Progress<long>((i) => this.txtBoardCreationProgress.Text = i.ToString());
            this.currentBoard = await Task.Run(() => lg.CreateBoard(numberOfPieces, progress));
            this.cachedLocations = this.currentBoard.Locations;
            this.boardViewModel = lg.CreateViewModelWithTextures(currentBoard);

            this.Setup(boardViewModel);
        }

        private void ClearText()
        {
            this.txtBoardCreationProgress.Text = string.Empty;
            this.txtBoardsExplored.Text = string.Empty;
            this.txtBoardsLeft.Text = string.Empty;
            this.txtInfo.Text = string.Empty;
            this.txtMovesNeeded.Text = string.Empty;
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

                if (boardViewModel.CanPieceMove(currentClickPosition))
                {
                    boardViewModel.CalculatePossibleMoves(currentClickPosition);
                    boardViewModel.HighlightPiece(currentClickPosition);
                    this.currentClickPosition = currentClickPosition; //store current click position                  
                }
            }
            else if (clickType == ClickType.DoubleClick && this.allowRotation)
            {
                this.boardViewModel.Rotate(currentClickPosition);    
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
            await SolveBoard();

        }

        private async Task SolveBoard()
        {
            this.txtInfo.Text = string.Empty;
            this.stackPanelMovesNeeded.Visibility = System.Windows.Visibility.Collapsed;

            var progress = new Progress<Tuple<long, long>>(i =>
            {
                this.txtBoardsLeft.Text = i.Item1.ToString();
                this.txtBoardsExplored.Text = i.Item2.ToString();
            });

            var solved = await Task.Run(() => this.lg.Solve(new Board(this.currentBoard, this.cachedLocations), progress));

            if (solved == null) //no solution or stoprequested
            {
                this.txtInfo.Text = "No solution found or stop requested!";
            }
            else
            {
                // Reverse the solved->start parent chain
                solution = new Stack<Board>();
                while (null != solved)
                {
                    solution.Push(solved);
                    solved = solved.Parent;
                }

                //popup first element it is a duplicate (!find the reason, seems to be a bug?)
                solution.Pop();

                //prepare cache
                this.cachedSolution = new Stack<Board>();

                this.stackPanelMovesNeeded.Visibility = System.Windows.Visibility.Visible;
                this.txtInfo.Text = "Solution has been found.";
                this.txtMovesNeeded.Text = solution.Count().ToString();
            }
        }



        private void Button_ClickShowSolution(object sender, RoutedEventArgs e)
        {
            this.ShowSolution();
        }

        private void Button_ClickResetSoltion(object sender, RoutedEventArgs e)
        {
            while(this.solution.Count > 0)
            {
                this.cachedSolution.Push(this.solution.Pop());
            }

            this.solution = new Stack<Board>();

            while(this.cachedSolution.Count > 0)
            {
                this.solution.Push(this.cachedSolution.Pop());
            }

            this.ShowSolution();
        }

        private void ShowSolution()
        {
            if (this.solution.Count > 0)
            {
                var board = solution.Pop();
                //cache the solution so that we can play it again
                this.cachedSolution.Push(board);
                var bvm = new BoardViewModel(board.Pieces[0], board.Pieces.Skip(1).ToList());
                this.boardViewModel = bvm;
                this.Setup(bvm);
            }
        }

        private void Button_ClickStop(object sender, RoutedEventArgs e)
        {
            lg.StopSolving();
        }

        private void CheckBox_Checked(object sender, RoutedEventArgs e)
        {
            this.allowRotation = true;
        }

        private void CheckBox_Unchecked(object sender, RoutedEventArgs e)
        {
            this.allowRotation = false;
        }


    }

    public enum ClickType
    {
        SingleClick = 1,
        DoubleClick = 2
    }
}
