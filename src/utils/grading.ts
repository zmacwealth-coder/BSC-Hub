export interface GradeResult {
  totalScore: number;
  grade: string;
  remark: string;
}

export function calculateGrade(caScore: number, examScore: number): GradeResult {
  const ca = Math.round(caScore);
  const exam = Math.round(examScore);

  if (ca < 0 || ca > 30) {
    throw new Error('Validation bounds error: CA score must be an integer between 0 and 30');
  }
  if (exam < 0 || exam > 70) {
    throw new Error('Validation bounds error: Exam score must be an integer between 0 and 70');
  }

  const totalScore = ca + exam;
  let grade = 'F';
  let remark = 'Fail';

  if (totalScore >= 70) {
    grade = 'A';
    remark = 'Excellent';
  } else if (totalScore >= 60) {
    grade = 'B';
    remark = 'Very Good';
  } else if (totalScore >= 50) {
    grade = 'C';
    remark = 'Good';
  } else if (totalScore >= 40) {
    grade = 'P';
    remark = 'Pass';
  }

  return { totalScore, grade, remark };
}
