// src/contexts/CompetencyContext.jsx
import React, { createContext, useContext, useState } from "react";

const CompetencyContext = createContext();
export const useCompetency = () => useContext(CompetencyContext);

// ตัวอย่าง mock data
const mockCompetencyData = [
  {
    studentId: "65311187",
    name: "ชัยศิริ ไกยสิทธิ์",
    department: "เทคโนโลยีสารสนเทศ",
    year: 4,
    grade: "2.2",
    skill: "Teamwork, Problem Solving",
    hardSkill: "Python, JavaScript",
    softSkill: "Communication, Leadership",
    subject1: "Python Programming",
    subject2: "Cloud Computing",
    subject3: "Software Engineering",
    subject4: "Modern Computer Languages",
    subject5: "Program Auditing",
    subject6: "Data Science",
    projectFile: { name: "project_chaisiri.pdf" },
    transcriptFile: { name: "transcript_chaisiri.pdf" },
    activityFile: { name: "activity_chaisiri.pdf" },
  },
  {
    studentId: "65313655",
    name: "ภารดา วรรณทิพย์",
    department: "เทคโนโลยีสารสนเทศ",
    year: 4,
    grade: "2.1",
    skill: "Critical Thinking, Creativity",
    hardSkill: "Java, .NET Framework",
    softSkill: "Time Management, Teamwork",
    subject1: "Functional Programming",
    subject2: "Mobile Application Development",
    subject3: "Game Design and Development",
    subject4: "Entrepreneurship in Computer Technology",
    subject5: "Information Retrieval",
    subject6: "Decision Support Systems",
    projectFile: { name: "project_parada.pdf" },
    transcriptFile: { name: "transcript_parada.pdf" },
    activityFile: { name: "activity_parada.pdf" },
  },
  {
    studentId: 'CSIT001',
    name: 'สมชาย ใจดี',
    department: 'วิทยาการคอมพิวเตอร์',
    year: 1,
    grade: 3.5,
    skill: 'Python, HTML, CSS',
    hardSkill: 'Programming, Database',
    softSkill: 'Teamwork, Communication',
    subject1: 'คณิตศาสตร์ 1',
    subject2: 'ฟิสิกส์ 1',
    subject3: 'การเขียนโปรแกรมเบื้องต้น',
    subject4: 'ภาษาอังกฤษ 1',
    subject5: 'ทฤษฎีการสื่อสาร',
    subject6: 'การออกแบบเว็บ',
    projectFile: { name: 'project1.pdf' },
    transcriptFile: { name: 'transcript1.pdf' },
    activityFile: { name: 'activity1.pdf' }
  },
  {
    studentId: 'CSIT002',
    name: 'สมหญิง แสนดี',
    department: 'เทคโนโลยีสารสนเทศ',
    year: 2,
    grade: 3.8,
    skill: 'Java, React, SQL',
    hardSkill: 'Web Development, Networking',
    softSkill: 'Problem Solving, Leadership',
    subject1: 'คณิตศาสตร์ 2',
    subject2: 'โครงสร้างข้อมูล',
    subject3: 'ระบบปฏิบัติการ',
    subject4: 'ภาษาอังกฤษ 2',
    subject5: 'ฐานข้อมูล',
    subject6: 'เครือข่ายคอมพิวเตอร์',
    projectFile: { name: 'project2.pdf' },
    transcriptFile: { name: 'transcript2.pdf' },
    activityFile: null
  },
  {
    studentId: 'CSIT003',
    name: 'สมปอง เรียบร้อย',
    department: 'วิทยาการคอมพิวเตอร์',
    year: 3,
    grade: 3.2,
    skill: 'C++, Python',
    hardSkill: 'Algorithm, Data Analysis',
    softSkill: 'Teamwork, Critical Thinking',
    subject1: 'การเขียนโปรแกรมเชิงวัตถุ',
    subject2: 'วิศวกรรมซอฟต์แวร์',
    subject3: 'ปัญญาประดิษฐ์',
    subject4: 'การประมวลผลภาพ',
    subject5: 'ฐานข้อมูลขั้นสูง',
    subject6: 'ระบบเครือข่าย',
    projectFile: null,
    transcriptFile: { name: 'transcript3.pdf' },
    activityFile: { name: 'activity3.pdf' }
  }
];

export const CompetencyProvider = ({ children }) => {
  const [competencyData, setCompetencyData] = useState(mockCompetencyData);

  const addCompetency = (data) => {
    setCompetencyData((prev) => [...prev, data]);
  };

  return (
    <CompetencyContext.Provider value={{ competencyData, addCompetency }}>
      {children}
    </CompetencyContext.Provider>
  );
};
