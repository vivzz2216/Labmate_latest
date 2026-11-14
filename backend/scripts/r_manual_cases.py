"""Reference R lab experiments: manual text, reference solution and output checks.

Each case is an ordinary university R practical. The solution is plain R that a student could type; it is run by a
real Rscript and photographed in the RStudio workspace by run_r_manuals.py. `expect` lists regular expressions that
must appear in the real console output, and `plots` is the minimum number of figures the experiment must draw.
"""

CASES = [
    {
        "number": 1, "slug": "vectors", "title": "Vectors, Operators and Built-in Functions", "category": "R Basics",
        "filename": "exp1_vectors.R", "plots": 0, "views": 0,
        "aim": "To create numeric, character and logical vectors in R and to apply arithmetic, comparison, indexing and summary functions to them.",
        "theory": "A vector is the basic data structure of R: an ordered collection of values of one type. Arithmetic and comparison operators work element by element (vectorisation), vectors can be indexed by position, by name or by a logical condition, and built-in functions such as sum(), mean(), min() and max() summarise them.",
        "procedure": ["Create a named numeric vector of marks and print it.", "Apply arithmetic and comparison operators to the whole vector.", "Subset the vector by position and by a logical condition.", "Create character and logical vectors and use string and logical helpers.", "Summarise the numeric vector with length(), sum(), mean(), min() and max().", "Generate sequences with seq() and rep() and sort the marks."],
        "task": "Write an R script that creates numeric, character and logical vectors, performs vectorised arithmetic and comparisons, subsets with an index and a condition, and prints length(), sum(), mean(), min(), max(), seq() and rep() results.",
        "expect": [r"Asha\s+Bala\s+Chitra\s+Dev\s+Esha", r"\[1\] 77\.8", r"\[1\]\s+1\s+4\s+7\s+10", r"\[1\] \"DATA\""],
        "code": '''# Experiment 1: Vectors, operators and built-in functions
marks <- c(72, 85, 90, 64, 78)
names(marks) <- c("Asha", "Bala", "Chitra", "Dev", "Esha")
marks
marks + 5
marks * 2
marks > 75
marks[marks > 75]
marks[c(1, 3)]
words <- c("data", "science", "using", "R")
toupper(words)
nchar(words)
paste(words, collapse = " ")
flags <- c(TRUE, FALSE, TRUE, TRUE)
sum(flags)
any(flags)
all(flags)
length(marks)
sum(marks)
mean(marks)
min(marks); max(marks)
seq(1, 10, by = 3)
rep(c("A", "B"), times = 2)
sort(marks, decreasing = TRUE)
'''},
    {
        "number": 2, "slug": "descriptive", "title": "Descriptive Statistics on the mtcars Dataset", "category": "Statistics",
        "filename": "exp2_descriptive_stats.R", "plots": 0, "views": 0,
        "aim": "To summarise a dataset with measures of central tendency and dispersion using the built-in mtcars data.",
        "theory": "Descriptive statistics condense a sample into a few numbers. The mean, median and mode describe the centre; the variance, standard deviation, range and inter-quartile range describe the spread; quantiles locate positions in the ordered data.",
        "procedure": ["Load the built-in mtcars dataset and inspect it with str() and summary().", "Compute the mean, median, variance and standard deviation of mpg.", "Find the range, quartiles and inter-quartile range.", "Tabulate the cylinders and find the mode."],
        "task": "Write an R script that loads the built-in mtcars dataset, prints str() and summary(), and computes the mean, median, variance, standard deviation, range and quartiles of mpg, plus the mode of cyl.",
        "expect": [r"32 obs\. of\s+11 variables", r"Mean\s*:\s*20\.091", r"Standard deviation\s*:\s*6\.027", r"Mode of cyl\s*:\s*8"],
        "code": '''# Experiment 2: Descriptive statistics on mtcars
data(mtcars)
str(mtcars)
summary(mtcars$mpg)
mean_mpg <- mean(mtcars$mpg)
median_mpg <- median(mtcars$mpg)
var_mpg <- var(mtcars$mpg)
sd_mpg <- sd(mtcars$mpg)
cat("Mean               :", round(mean_mpg, 3), "\\n")
cat("Median             :", median_mpg, "\\n")
cat("Variance           :", round(var_mpg, 3), "\\n")
cat("Standard deviation :", round(sd_mpg, 3), "\\n")
range(mtcars$mpg)
quantile(mtcars$mpg, c(0.25, 0.5, 0.75))
IQR(mtcars$mpg)
table(mtcars$cyl)
mode_cyl <- as.numeric(names(which.max(table(mtcars$cyl))))
cat("Mode of cyl        :", mode_cyl, "\\n")
'''},
    {
        "number": 3, "slug": "dataframes", "title": "Data Frames: Subsetting, Sorting and Aggregation", "category": "Data Manipulation",
        "filename": "exp3_data_frames.R", "plots": 0, "views": 1,
        "aim": "To build a data frame and to subset, sort, extend, merge and aggregate it.",
        "theory": "A data frame is a table whose columns are vectors of equal length. Rows are selected with a logical condition, reordered with order(), joined with merge() and summarised by group with aggregate().",
        "procedure": ["Create a data frame of students with name, branch and marks.", "Filter the rows whose marks exceed 75.", "Sort the data frame by marks in descending order.", "Add a grade column with ifelse().", "Merge it with a second data frame holding the head of each branch.", "Aggregate the mean marks by branch and open the data in the viewer."],
        "task": "Write an R script that builds a data frame of students (name, branch, marks), filters rows with a condition, sorts with order(), adds a grade column with ifelse(), merges it with a second data frame and aggregates the mean marks by branch.",
        "expect": [r"Dr\. Rao", r"CSE\s+87\.3", r"\bgrade\b"],
        "code": '''# Experiment 3: Data frames - subsetting, sorting and aggregation
students <- data.frame(
  name = c("Asha", "Bala", "Chitra", "Dev", "Esha", "Farah"),
  branch = c("CSE", "ECE", "CSE", "MECH", "ECE", "CSE"),
  marks = c(88, 72, 93, 65, 79, 81)
)
students
students[students$marks > 75, ]
sorted <- students[order(-students$marks), ]
sorted
students$grade <- ifelse(students$marks >= 85, "A",
                         ifelse(students$marks >= 70, "B", "C"))
students
branches <- data.frame(
  branch = c("CSE", "ECE", "MECH"),
  hod = c("Dr. Rao", "Dr. Iyer", "Dr. Khan")
)
merged <- merge(students, branches, by = "branch")
merged
avg_by_branch <- aggregate(marks ~ branch, data = students, FUN = mean)
avg_by_branch
cat("Rows:", nrow(students), " Columns:", ncol(students), "\\n")
View(students)
'''},
    {
        "number": 4, "slug": "base_graphics", "title": "Base Graphics: Histogram, Box Plot and Scatter Plot", "category": "Visualization",
        "filename": "exp4_base_graphics.R", "plots": 1, "views": 0,
        "aim": "To visualise the distribution of one variable and the relationship between two variables with base R graphics.",
        "theory": "A histogram shows the shape of a distribution, a box plot compares groups through their quartiles and a scatter plot reveals the relationship between two numeric variables. par(mfrow) places several plots on one device.",
        "procedure": ["Arrange four plots in a 2 x 2 grid with par(mfrow).", "Draw a histogram of mpg.", "Draw a box plot of mpg for each number of cylinders.", "Draw a scatter plot of weight against mpg and add the least-squares line.", "Draw a bar plot of the number of cars per cylinder count and print the correlation."],
        "task": "Write an R script that uses the built-in mtcars dataset to draw a histogram of mpg, a box plot of mpg by cyl and a scatter plot of wt against mpg with abline(lm()), arranged with par(mfrow), and prints cor(wt, mpg).",
        "expect": [r"Correlation between wt and mpg\s*:\s*-0\.8677"],
        "code": '''# Experiment 4: Base graphics
data(mtcars)
par(mfrow = c(2, 2))
hist(mtcars$mpg, main = "Histogram of mpg", xlab = "Miles per gallon",
     col = "steelblue", border = "white")
boxplot(mpg ~ cyl, data = mtcars, main = "mpg by cylinders",
        xlab = "Cylinders", ylab = "mpg", col = c("tomato", "gold", "skyblue"))
plot(mtcars$wt, mtcars$mpg, main = "Weight vs mpg", xlab = "Weight (1000 lbs)",
     ylab = "mpg", pch = 19, col = "darkgreen")
abline(lm(mpg ~ wt, data = mtcars), col = "red", lwd = 2)
barplot(table(mtcars$cyl), main = "Cars per cylinder count",
        xlab = "Cylinders", ylab = "Cars", col = "orchid")
par(mfrow = c(1, 1))
r <- cor(mtcars$wt, mtcars$mpg)
cat("Correlation between wt and mpg :", round(r, 4), "\\n")
'''},
    {
        "number": 5, "slug": "regression", "title": "Simple and Multiple Linear Regression", "category": "Regression",
        "filename": "exp5_linear_regression.R", "plots": 1, "views": 0,
        "aim": "To fit simple and multiple linear regression models with lm(), interpret them and predict new values.",
        "theory": "Linear regression models a response as a linear combination of predictors. lm() estimates the coefficients by least squares; summary() reports their significance and the coefficient of determination R-squared, anova() compares nested models and predict() evaluates the model on new data.",
        "procedure": ["Fit a simple model of mpg on weight and print its summary.", "Fit a multiple model of mpg on weight and horsepower.", "Compare the two models with anova().", "Predict mpg for three new cars.", "Plot the data with the fitted line."],
        "task": "Write an R script that fits lm(mpg ~ wt) and lm(mpg ~ wt + hp) on mtcars, prints summary() and anova(), predicts mpg for new cars with predict(), and plots the fitted line over the data.",
        "expect": [r"Multiple R-squared:\s+0\.7528", r"Residual standard error", r"R-squared \(simple\)\s*:\s*0\.7528"],
        "code": '''# Experiment 5: Simple and multiple linear regression
data(mtcars)
model1 <- lm(mpg ~ wt, data = mtcars)
summary(model1)
model2 <- lm(mpg ~ wt + hp, data = mtcars)
summary(model2)
anova(model1, model2)
newcars <- data.frame(wt = c(2.5, 3.0, 3.5), hp = c(100, 120, 150))
predicted <- predict(model2, newdata = newcars)
predicted
cat("R-squared (simple)   :", round(summary(model1)$r.squared, 4), "\\n")
cat("R-squared (multiple) :", round(summary(model2)$r.squared, 4), "\\n")
plot(mtcars$wt, mtcars$mpg, pch = 19, col = "navy",
     main = "mpg ~ wt", xlab = "Weight (1000 lbs)", ylab = "mpg")
abline(model1, col = "red", lwd = 2)
legend("topright", legend = "Least-squares line", col = "red", lwd = 2)
'''},
    {
        "number": 6, "slug": "hypothesis", "title": "Hypothesis Testing: t-test and Chi-square Test", "category": "Statistics",
        "filename": "exp6_hypothesis_tests.R", "plots": 0, "views": 0,
        "aim": "To test hypotheses about means and about the independence of categorical variables using t.test() and chisq.test().",
        "theory": "A hypothesis test compares a null hypothesis with the evidence in a sample. The t-test judges means; the chi-square test of independence judges whether two categorical variables are associated. The null hypothesis is rejected when the p-value is below the significance level alpha.",
        "procedure": ["Run a one-sample t-test on mpg against a mean of 20.", "Run a two-sample t-test of mpg for automatic and manual cars.", "Run a paired t-test on the sleep data.", "Run a chi-square test of independence between cylinders and transmission.", "Print a decision for each test at alpha = 0.05."],
        "task": "Write an R script that runs a one-sample t.test on mtcars mpg, a two-sample t.test of mpg by transmission (am), a paired t.test on the built-in sleep data and a chisq.test on table(mtcars$cyl, mtcars$am), and prints a decision for each at alpha = 0.05.",
        "expect": [r"One Sample t-test", r"Welch Two Sample t-test", r"Paired t-test", r"Pearson's Chi-squared test", r"Reject H0"],
        "code": '''# Experiment 6: Hypothesis testing
data(mtcars)
data(sleep)
decide <- function(p, alpha = 0.05) {
  if (p < alpha) "Reject H0" else "Fail to reject H0"
}
t1 <- t.test(mtcars$mpg, mu = 20)
t1
t2 <- t.test(mpg ~ am, data = mtcars)
t2
drug1 <- sleep$extra[sleep$group == 1]
drug2 <- sleep$extra[sleep$group == 2]
t3 <- t.test(drug1, drug2, paired = TRUE)
t3
chi <- chisq.test(table(mtcars$cyl, mtcars$am))
chi
cat("One-sample t-test :", decide(t1$p.value), "\\n")
cat("Two-sample t-test :", decide(t2$p.value), "\\n")
cat("Paired t-test     :", decide(t3$p.value), "\\n")
cat("Chi-square test   :", decide(chi$p.value), "\\n")
'''},
    {
        "number": 7, "slug": "ggplot2", "title": "ggplot2: Grammar of Graphics and Facets", "category": "Visualization",
        "filename": "exp7_ggplot2.R", "plots": 2, "views": 0, "packages": ["ggplot2"],
        "aim": "To build layered and faceted statistical graphics with the ggplot2 package.",
        "theory": "ggplot2 builds a plot from a dataset, aesthetic mappings and layers of geometric objects. Smoothers add trends, scales and labels describe the axes, and facet_wrap() splits one plot into panels by a categorical variable.",
        "procedure": ["Load ggplot2 and prepare factor columns in mtcars.", "Draw a scatter plot of weight against mpg coloured by cylinders with a linear smoother.", "Draw a bar chart of car counts by cylinders faceted by transmission.", "Print the first rows of the prepared data."],
        "task": "Write an R script that loads ggplot2 and draws, from the built-in mtcars data, a scatter plot of wt against mpg coloured by factor(cyl) with geom_smooth(method = 'lm'), then a bar chart of car counts by cyl faceted by transmission, with titles and theme_minimal().",
        "expect": [r"cyl_f", r"Automatic|Manual"],
        "code": '''# Experiment 7: ggplot2 - grammar of graphics
library(ggplot2)
data(mtcars)
mtcars$cyl_f <- factor(mtcars$cyl)
mtcars$trans <- factor(mtcars$am, labels = c("Automatic", "Manual"))
p1 <- ggplot(mtcars, aes(x = wt, y = mpg, colour = cyl_f)) +
  geom_point(size = 3) +
  geom_smooth(method = "lm", se = FALSE) +
  labs(title = "Fuel efficiency vs weight", x = "Weight (1000 lbs)",
       y = "Miles per gallon", colour = "Cylinders") +
  theme_minimal()
print(p1)
p2 <- ggplot(mtcars, aes(x = cyl_f, fill = cyl_f)) +
  geom_bar() +
  facet_wrap(~ trans) +
  labs(title = "Cars by cylinders and transmission", x = "Cylinders",
       y = "Number of cars", fill = "Cylinders") +
  theme_minimal()
print(p2)
head(mtcars[, c("mpg", "cyl_f", "trans")])
'''},
    {
        "number": 8, "slug": "ml", "title": "Clustering and Classification: k-means and Decision Tree", "category": "Machine Learning",
        "filename": "exp8_kmeans_tree.R", "plots": 1, "views": 0,
        "aim": "To group observations with k-means clustering and to classify them with a decision tree built by rpart.",
        "theory": "k-means partitions observations into k clusters by minimising the distance to cluster centres. A decision tree learns a hierarchy of threshold tests on the features; its quality is judged on held-out data with a confusion matrix and the accuracy.",
        "procedure": ["Set the random seed and cluster the iris measurements into three groups.", "Compare the clusters with the true species using a table.", "Plot the clusters and their centres.", "Split iris into 70 percent training and 30 percent test rows.", "Train an rpart classification tree and predict the test rows.", "Print the confusion matrix and the accuracy."],
        "task": "Write an R script that runs set.seed(42), clusters the iris measurements with kmeans(centers = 3), compares clusters with Species using table(), plots the clusters, then trains an rpart decision tree on a 70/30 split of iris and prints the confusion matrix and accuracy.",
        "expect": [r"Cluster", r"Accuracy\s*:\s*0\.\d+", r"n= 105"],
        "code": '''# Experiment 8: k-means clustering and decision tree classification
set.seed(42)
data(iris)
features <- iris[, 1:4]
km <- kmeans(features, centers = 3, nstart = 20)
table(Cluster = km$cluster, Species = iris$Species)
km$size
plot(iris$Petal.Length, iris$Petal.Width, col = km$cluster, pch = 19,
     xlab = "Petal length", ylab = "Petal width",
     main = "k-means clusters (k = 3)")
points(km$centers[, 3], km$centers[, 4], pch = 8, cex = 2, lwd = 2)
library(rpart)
idx <- sample(seq_len(nrow(iris)), size = 0.7 * nrow(iris))
train <- iris[idx, ]
test <- iris[-idx, ]
tree <- rpart(Species ~ ., data = train, method = "class")
print(tree)
pred <- predict(tree, test, type = "class")
cm <- table(Actual = test$Species, Predicted = pred)
cm
accuracy <- sum(diag(cm)) / sum(cm)
cat("Accuracy :", round(accuracy, 4), "\\n")
'''},
]

for _case in CASES:
    _case["objective"] = _case["task"]
