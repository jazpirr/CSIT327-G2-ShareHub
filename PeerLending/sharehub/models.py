from django.contrib.auth.models import AbstractUser
from django.db import models
 
class CustomUser(AbstractUser):
    username = None 
 
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    birthday = models.DateField(blank=True, null=True)
 
    COLLEGE_DEPARTMENTS = [
        ("CCS", "College of Computer Studies"),
        ("CNAHS", "College of Nursing & Allied Health Sciences"),
        ("CEA", "College of Engineering and Architecture"),
        ("CASE", "College of Arts, Sciences and Education"),
        ("CMBA", "College of Management, Business and Accountancy"),
        ("CCJ", "College of Criminal Justice"),

    ]
    DEPARTMENT_COURSES = {
        "CCS": ["BSIT", "BSCS"],
        "CNAHS": ["BSN", "BSP", "BSMT"],
        "CEA": ["BSCE", "BSArch","BSChE","BSCpE","BSEE","BSECE","BSIE","BSME with Computational Science", "BSME with Mechatronics", "BSMinE"],
        "CASE": ["AB Comm", "AB Eng", "BEED","BSED","BMA","BS Bio","BS Math","BS Psych"],
        "CMBA": ["BSA", "BSBA","BSAIS","BSMA","BSHM","BSTM","BSOA","AOA","BPA"],
        "CCJ": ["BS Crim"],
    }

    YEAR_LEVELS = [
        ("1", "1"),
        ("2", "2"),
        ("3", "3"),
        ("4", "4"),
        ("5", "5"),
    ]
 
    college_dept = models.CharField(
        max_length=50, choices=COLLEGE_DEPARTMENTS, blank=True, null=True
    )
    course = models.CharField(max_length=100, blank=True, null=True)
    year_level = models.CharField(
        max_length=1, choices=YEAR_LEVELS, blank=True, null=True
    )
 
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]
 
    def __str__(self):
        return self.email