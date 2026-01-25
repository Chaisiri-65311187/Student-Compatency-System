-- Migration: เปลี่ยน student_trainings ให้รองรับการกรอกชื่อโดยตรง + file upload
-- วันที่: 2026-01-24

-- 1. เพิ่มคอลัมน์ title และ proof_file_path ใหม่
ALTER TABLE student_trainings 
  ADD COLUMN title VARCHAR(500) NULL AFTER training_id,
  ADD COLUMN proof_file_path VARCHAR(500) NULL AFTER proof_url;

-- 2. ย้ายข้อมูลจากตาราง trainings มาเก็บใน title (สำหรับข้อมูลเดิม)
UPDATE student_trainings st
JOIN trainings t ON t.id = st.training_id
SET st.title = t.title;

-- 3. ทำให้ training_id เป็น nullable (ข้อมูลใหม่ไม่ต้องมี training_id)
ALTER TABLE student_trainings
  MODIFY COLUMN training_id INT NULL;
