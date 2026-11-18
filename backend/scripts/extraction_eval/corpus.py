"""Test manuals in the formats real students upload, each with its expected questions.

expect: list of (key phrase that must appear in exactly one extracted question, language)
"""

M = {}

M["01_mu_classic"] = dict(mode="code_only", text="""University of Mumbai
Department of Computer Engineering
Python Programming Lab (SBL)
Experiment No. 1
Aim: To write a Python program to find the factorial of a number using recursion.
Theory: Recursion is a technique in which a function calls itself.
Procedure:
1. Open IDLE.
2. Type the program and save it.
Program:
Output:
Conclusion: Thus we have studied recursion.
Experiment No. 2
Aim: To write a Python program to check whether a string is a palindrome.
Theory: A palindrome reads the same forwards and backwards.
Program:
Output:
Experiment No. 3
Aim: To write a Python program to count the frequency of each word in a sentence using a dictionary.
Theory: Dictionaries store key-value pairs.
Program:
Output:
""", expect=[("factorial", "python"), ("palindrome", "python"), ("frequency of each word", "python")])

M["02_single_line_experiments"] = dict(mode="code_only", text="""Python Lab Manual - Practice Set
Experiment 1: Write a Python program to print the sum of the first 10 natural numbers.
Experiment 2: Write a Python program to check whether a given number is even or odd. Test it with the number 7.
Experiment 3: Write a Python program to print the multiplication table of 5.
""", expect=[("sum of the first 10", "python"), ("even or odd", "python"), ("multiplication table", "python")])

M["03_numbered_wap_with_theory_viva"] = dict(mode="code_only", text="""Python Programming Lab - Assignment 2
Theory:
1. What is a list?
2. Explain tuples with an example.
Lab Exercises:
1. Write a program to reverse a list without using reverse().
2. Write a program to count the vowels in a string.
3. WAP to find the largest of three numbers.
4. Write a program to print the Fibonacci series up to n terms.
5. WAP to swap two numbers without using a third variable.
Viva Questions:
1. What is the difference between a list and a tuple?
2. Define mutable.
""", expect=[("reverse a list", "python"), ("vowels", "python"), ("largest of three", "python"),
             ("fibonacci", "python"), ("swap two numbers", "python")])

M["04_java_subparts"] = dict(mode="code_only", text="""Object Oriented Programming with Java Lab
Practical No. 5
Title: Inheritance in Java
Aim: To implement different types of inheritance in Java.
Lab Exercise:
a) Write a Java program to demonstrate single inheritance using Animal and Dog classes.
b) Write a Java program to demonstrate multilevel inheritance using Person, Employee and Manager classes.
c) Write a Java program to show method overriding.
Post Lab Questions:
1. What is the use of the super keyword?
""", expect=[("single inheritance", "java"), ("multilevel inheritance", "java"), ("method overriding", "java")])

M["05_question_headings"] = dict(mode="code_only", text="""C Programming Lab - Worksheet 3
Question 1: Write a C program to find the transpose of a 3x3 matrix.
Question 2: Write a C program to sort an array of 10 integers using bubble sort.
Question 3: Write a C program to count the number of words in a sentence entered by the user.
""", expect=[("transpose", "c"), ("bubble sort", "c"), ("number of words", "c")])

M["06_table_index"] = dict(mode="code_only", table=[
    ["Sr. No.", "Name of the Experiment", "Date", "Sign"],
    ["1", "Write a C++ program to implement a class Complex with operator overloading for + and -.", "", ""],
    ["2", "Write a C++ program to demonstrate function overloading for area of circle, rectangle and triangle.", "", ""],
    ["3", "Write a C++ program to implement a stack using templates.", "", ""],
    ["4", "Write a C++ program to handle division by zero using exception handling.", "", ""],
], text="""Department of Information Technology
Object Oriented Programming in C++ - List of Experiments
""", expect=[("operator overloading", "cpp"), ("function overloading", "cpp"), ("stack using templates", "cpp"),
             ("division by zero", "cpp")])

M["07_bda_steps_one_program"] = dict(mode="code_only", text="""Big Data Analytics Lab
Practical 2: Data Preprocessing using PySpark
Aim: To perform data preprocessing on a CSV dataset using PySpark in Google Colab.
Steps:
1. Install Java and Spark in Colab and create a SparkSession with appName 'Colab'.
2. Load the House_Rent_Dataset.csv file into a DataFrame using spark.read.csv with header=True and inferSchema=True.
3. Print the schema using df.printSchema() and summary statistics using df.describe().show().
4. Count the null values in every column and fill missing values in the Rent column with the column mean.
5. Save the preprocessed DataFrame to a new CSV file.
Conclusion: Thus data preprocessing was performed using PySpark.
""", expect=[("printschema", "colab")])

M["08_assignment_no_headings"] = dict(mode="code_only", text="""Data Structures Lab
Assignment No. 1
Implement a singly linked list in C with insert at beginning, insert at end, delete a node and display operations.
Assignment No. 2
Implement a stack using an array in C with push, pop and peek operations and handle overflow and underflow.
Assignment No. 3
Implement binary search on a sorted array of integers in C.
""", expect=[("singly linked list", "c"), ("push, pop", "c"), ("binary search", "c")])

M["09_sql_one_session"] = dict(mode="code_only", text="""Database Management System Lab
Experiment No. 4
Aim: To perform DDL and DML commands in SQL.
Lab Exercise:
Perform the following queries:
1. Create a table Student with columns roll_no, name, branch and marks.
2. Insert five records into the Student table.
3. Display all students from the Computer branch.
4. Update the marks of roll_no 3 to 85.
5. Delete the student whose roll_no is 5.
6. Display the average marks of all students.
""", expect=[("create a table student", "sql")])

M["10_theory_and_code_dc"] = dict(mode="theory_and_code", text="""Distributed Computing Lab
Experiment 1
Aim: Client Server Implementation using Java socket programming.
Theory Questions:
1. What is inter-process communication?
2. Explain the difference between TCP and UDP sockets.
3. List the commonly used port numbers and their usage.
Implementation:
Write a Java program to implement a TCP client and server where the client sends a string and the server returns it in uppercase.
Post Lab Questions:
1. What are the various types of socket classes in Java? Explain.
Conclusion:
Write the conclusion of the experiment.
""", expect=[("inter-process communication", "theory"), ("tcp and udp", "theory"), ("port numbers", "theory"),
             ("uppercase", "java"), ("socket classes", "theory")])

M["11_program_headings_c"] = dict(mode="code_only", text="""C Programming Laboratory
Program 1
Write a C program to find the roots of a quadratic equation.
Program 2
Write a C program to check whether a number is an Armstrong number.
Program 3
Write a C program to print Pascal's triangle for n rows.
Program 4
Write a C program to find the GCD of two numbers using recursion.
""", expect=[("quadratic", "c"), ("armstrong", "c"), ("pascal", "c"), ("gcd", "c")])

M["12_web_lab"] = dict(mode="code_only", text="""Internet Programming Lab
Experiment - 3: Form validation using JavaScript
1. Aim: To design a registration form and validate it using JavaScript.
2. Objective: Students will learn client side validation.
6. Pre-Experiment Theory:
Explain the Document Object Model.
7. Laboratory Exercise:
A. Procedure
Create a registration form with name, email, password and confirm password fields. Validate that the email is valid, the password has at least 8 characters and both passwords match. Show error messages below each field.
8. Post Experimental Exercise
Questions:
1. Write the difference between client side and server side validation.
""", expect=[("registration form", "html")])

M["13_mixed_lab_numbered_lines"] = dict(mode="code_only", text="""Python Lab - Experiment List (Sem III)
1) Write a Python program to read a text file and count the number of lines, words and characters.
2) Write a Python program to create a class BankAccount with deposit and withdraw methods.
3) Write a Python program to plot a bar chart of student marks using matplotlib.
4) Write a Python program using a lambda function and map() to square every element of a list.
5) Write a Python program to handle ZeroDivisionError and ValueError using try and except.
6) Write a Python program to sort a list of dictionaries by the value of the 'age' key.
""", expect=[("lines, words and characters", "python"), ("bankaccount", "python"), ("bar chart", "python"),
             ("lambda", "python"), ("zerodivisionerror", "python"), ("dictionaries by", "python")])

_HDR = "Vidyalankar Institute of Technology | Department of IT | Academic Year 2025-26"
M["14_page_headers_four_experiments"] = dict(mode="code_only", text=f"""{_HDR}
Data Structures Lab (ITL301)
Experiment No. 1
Aim: Implement a stack using an array in C.
Theory: A stack follows LIFO order.
Lab Exercise: Write a C program for push, pop and display operations with overflow and underflow checks.
Page 1 of 4
{_HDR}
Experiment No. 2
Aim: Implement a circular queue using an array in C.
Lab Exercise: Write a C program for enqueue, dequeue and display on a circular queue of size 5.
Page 2 of 4
{_HDR}
Experiment No. 3
Aim: Convert an infix expression to postfix using a stack.
Lab Exercise: Write a C program that converts (A+B)*C-D/E to postfix.
Page 3 of 4
{_HDR}
Experiment No. 4
Aim: Implement a binary search tree in C.
Lab Exercise: Write a C program to insert keys, and print inorder, preorder and postorder traversals.
Page 4 of 4
""", expect=[("push, pop", "c"), ("circular queue", "c"), ("postfix", "c"), ("binary search tree", "c")])

M["15_part_a_part_b"] = dict(mode="code_only", text="""Machine Learning Lab
Practical 6: Regression and Classification
Part A: Write a Python program to fit a linear regression model on the Boston-style housing data (area vs price) and print the slope, intercept and R2 score.
Part B: Write a Python program to train a logistic regression classifier on the Iris dataset and print the accuracy and confusion matrix.
Viva:
1. What is overfitting?
""", expect=[("linear regression", "python"), ("logistic regression", "python")])

M["16_wrapped_questions_and_handwritten"] = dict(mode="code_only", text="""Programming in Java - Lab Work
1. Write a Java program that reads the marks of five subjects from the user,
   computes the total and percentage, and prints the grade according to the
   university grading table.
2. Draw the class diagram for a library system neatly by hand in your journal.
3. Write a Java program to create a user-defined exception InvalidAgeException
   and throw it when the age entered is below 18.
4. Write a Java program to create two threads that print even and odd numbers
   alternately up to 20.
""", expect=[("grading table", "java"), ("invalidageexception", "java"), ("two threads", "java")])

M["17_theory_code_summary_wording"] = dict(mode="theory_and_code", text="""Distributed Computing Lab
Experiment 2
Aim: Implement Remote Method Invocation in Java.
Theory:
1. Explain the architecture of RMI with a diagram.
2. What is a stub and a skeleton?
Implementation:
Write a Java RMI program where the client calls a remote add(int a, int b) method on the server and prints the result.
Conclusion:
Write the summary, importance, and application of the experiment.
""", expect=[("architecture of rmi", "theory"), ("stub", "theory"), ("remote add", "java")])

M["18_react_node_multiline_experiments"] = dict(mode="code_only", text="""Web Programming Lab
Experiment 8: React components
Aim: To build a React application with reusable components.
Problem Statement:
Create a React app with a Navbar, a ProductCard component that receives name and price as props, and a Cart that shows the total.
Experiment 9: Node.js REST API
Aim: To build a REST API using Node.js and Express.
Problem Statement:
Create an Express server with GET /students and POST /students endpoints that store students in memory and return JSON.
""", expect=[("productcard", "react"), ("get /students", "node")])
