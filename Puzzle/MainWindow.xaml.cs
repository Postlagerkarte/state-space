using Common;
using LevelGenerator;
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

            this.Loaded += MainWindow_Loaded;
        }

        void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {

        }
        LevelGeneratorService levelGenerator = new LevelGeneratorService();

        private void Button_Click(object sender, RoutedEventArgs e)
        {

            var boardViewModel = levelGenerator.CreateValidBoard();
            this.CreateBoard(boardViewModel);
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
                    Grid.SetRow(boardCell, row);
                    Grid.SetColumn(boardCell, column);
                    gameBoard.Children.Add(boardCell);
                }
            }
        }
    }
}
