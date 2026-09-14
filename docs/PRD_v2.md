# 영유아 동영상 AI–교사 관찰기록 비교연구 웹사이트 PRD

**문서 버전:** v2.0  
**용도:** Claude Code 개발용 Product Requirements Document  
**연구유형:** 생성형 멀티모달 AI와 어린이집 교사의 영유아 동영상 관찰기록 비교연구  
**최종 연구설계:** 교사 20명 × 동일 영상 5편 = 총 100개 교사 관찰기록  
**연구영상:** 총 5편, 각 30~90초(1분 30초) 이내 (2026-09-14 상한 60초→90초 확대)  
**교사 1인당 본 관찰시간:** 영상당 최대 5분 × 5편 = 최대 25분  

---

## 1. 프로젝트 목적

본 웹사이트는 어린이집에서 촬영한 짧은 영유아 자연관찰 동영상에 대해 다음 연구자료를 표준화된 조건에서 수집·관리하기 위한 **연구 전용 웹 애플리케이션**이다.

- 어린이집 교사 20명이 동일한 5편의 영상을 관찰하고 자유서술형 관찰기록 작성
- 동일 영상에 대한 Gemini 등 생성형 멀티모달 AI 기술문 관리
- 독립적으로 구축한 기준 관찰자료(Reference Annotation)와 교사·AI 기술문 비교
- Precision, Recall, F1, Omission, Hallucination, Inference, Temporal Fidelity 등 연구지표 산출에 필요한 원자료 확보
- 관리자 공간에서 진행률, 영상별 기록, 작성시간, 재생행동, 코딩결과 확인 및 연구용 데이터 Export

이 시스템은 일반 설문 서비스가 아니라 **연구조건을 시스템 수준에서 통제하고, 원자료와 행동로그를 보존하는 연구 데이터 수집 도구**로 개발한다.

---

## 2. 최종 연구설계

### 2.1 기본 구조

- 연구 참여 교사: **20명**
- 본 연구영상: **5편**
- 모든 교사가 동일한 5편을 모두 관찰
- 교사 1명당 관찰기록: **5건**
- 영상 1편당 교사 관찰기록: **20건**
- 총 교사 관찰기록: **100건**
- 연습영상: 본 연구 영상과 별도의 **1편**
- 본 연구 영상 길이: **30~90초(1분 30초) 이내**
- 영상별 총 수행 제한시간: **최대 300초**

### 2.2 분석 구조

자료는 **교사 20명 × 영상 5편의 완전 교차 반복측정 구조(complete crossed repeated-measures design)**이다.

- 동일 교사가 5편을 반복 평가하므로 100개 기록은 서로 완전히 독립된 100개 표본이 아님
- 교사별 관찰·기록 성향 차이를 고려해 통계분석 시 **교사를 random effect**로 처리하는 mixed-effects model 검토
- 본 연구에서 목적적으로 선정한 영상 5편은 **fixed factor**로 우선 모델링
- 웹사이트는 추론통계의 연구결론을 자동 생성하지 않고, 분석에 필요한 원자료와 기술통계를 제공

예시 분석 구조:

```text
Outcome ~ Video + Order + (1 | Teacher)
```

---

## 3. 연구영상 5편 구성 원칙

영상 수가 5편으로 제한되는 만큼, 서로 다른 관찰 특성을 대표하도록 목적적으로 선정한다.

| 영상 | 대표 상황 예시 | 주요 관찰 요소 |
|---|---|---|
| V01 | 1인 사물 탐색·조작 | 손동작, 사물 사용 |
| V02 | 미세 사물조작 | 손가락, 시선, 작은 행동 변화 |
| V03 | 또래 상호작용(2인) | 행위자-행동-대상 관계 |
| V04 | 또래 상호작용(3인 이상) | 행위자-행동-대상 관계 |
| V05 | 복합 자유놀이 | 동시행동, 선택적 주의, 행동 전환 |

관리자 화면에서는 각 영상에 다음 메타데이터를 저장할 수 있어야 한다.

- 영상 코드
- 관리자용 제목
- 길이
- 영유아 연령대
- 활동유형
- 등장인물 수
- 주요 사물 수
- 복잡성 수준
- 오디오 포함 여부
- 관리자 메모

참여교사에게 연구상 분류명이나 난이도는 노출하지 않는다.

---

## 4. 영상 제시순서 설계

모든 참여자가 동일한 5편을 보되 순서효과를 줄이기 위해 **5개 순서조건을 4명씩 배정**한다.

| 순서그룹 | 영상 제시순서 | 배정 인원 |
|---|---|---:|
| O1 | V01 → V02 → V03 → V04 → V05 | 4명 |
| O2 | V02 → V03 → V04 → V05 → V01 | 4명 |
| O3 | V03 → V04 → V05 → V01 → V02 | 4명 |
| O4 | V04 → V05 → V01 → V02 → V03 | 4명 |
| O5 | V05 → V01 → V02 → V03 → V04 | 4명 |

이에 따라 각 영상은 제시순서 1~5 위치에 각각 정확히 4회씩 배치된다.

### 시스템 요구사항

- 참여자 생성 시 하나의 `order_group` 배정
- 각 order group의 목표 유효 참여자는 4명
- 관리자는 그룹별 배정 현황 확인 가능
- 중도탈락자가 생기면 동일 그룹에 대체 참여자 배정 가능
- 연구 시작 후 개별 참여자의 순서 자동변경 금지
- 순서 변경은 관리자 권한으로만 가능하며 audit log 필수

---

## 5. 사용자 역할

### 5.1 Participant — 참여 교사

가능:

- 개인 연구 참여 링크 또는 참여코드/PIN으로 접속
- 연구 안내 확인 및 동의
- 기본정보 입력
- 온보딩 및 연습영상 수행
- 지정된 순서에 따라 본 영상 5편 관찰
- 자유서술형 관찰기록 작성
- 중단 후 미완료 위치부터 재접속
- 연구 완료

불가능:

- 다른 참여자 기록 열람
- AI 기술문 열람
- Reference Annotation 열람
- 제출 후 기록 수정
- 제시순서 임의 변경
- 영상 다운로드
- 연구 완료 후 영상 재열람
- 연구 결과 확인

### 5.2 Admin — 연구 관리자

가능:

- 연구 설정
- 영상 등록 및 관리
- 참여자 생성 및 순서그룹 배정
- 참여 진행률 확인
- 교사 관찰기록 원문 확인
- 영상 재생·정지·되감기 등 interaction log 확인
- 기술적 오류 세션 무효화 및 재시도 생성
- AI 기술문 등록
- Reference Annotation 관리
- Claim Coding
- 기술통계 및 분석용 데이터 확인
- CSV/XLSX Export
- 연구설정 및 주요 변경 이력 확인

---

## 6. 참여자 인증

일반 회원가입은 사용하지 않는다.

권장 방식:

```text
개인 연구 참여 링크
→ participant_code 또는 PIN 확인
→ 인증
→ 진행상태 복원
```

참여자 코드 예:

```text
T01, T02, ... T20
```

실명은 시스템에서 필수 수집하지 않는다. 실제 참여자와 연구용 코드의 매핑이 필요하면 연구자가 별도의 오프라인 문서에서 관리한다.

---

## 7. 참여자 UX Flow

```text
개인 연구 참여 링크
      ↓
참여자 인증
      ↓
환영 화면
      ↓
연구·영상보안 안내
      ↓
참여 동의
      ↓
기본정보 입력
      ↓
관찰 방법 안내
      ↓
연습영상
      ↓
본 관찰 시작
      ↓
관찰 1 / 5
      ↓
관찰 2 / 5
      ↓
관찰 3 / 5
      ↓
관찰 4 / 5
      ↓
관찰 5 / 5
      ↓
최종 완료
```

브라우저를 종료하더라도 이미 제출한 관찰은 잠기며 **마지막 미완료 관찰부터 이어서 진행**한다.

---

## 8. 참여자 온보딩

비대면으로 링크만 전달받은 교사도 혼자 참여할 수 있도록 짧고 친절하게 구성한다.

### 8.1 환영 화면

권장 문구:

> 영유아 관찰기록 연구에 참여해 주셔서 감사합니다.
>
> 짧은 영유아 활동영상을 관찰하고 평소 어린이집에서 기록하시는 방식으로 관찰내용을 작성하게 됩니다.
>
> - 총 5개의 영상을 관찰합니다.
> - 각 영상은 1분 30초 이내입니다.
> - 영상 한 편당 최대 5분이 주어집니다.
> - 전체 본 관찰은 최대 약 25분입니다.
> - 정답을 맞히는 시험이 아닙니다.
> - 평소 관찰기록을 작성하듯 자연스럽게 기록해 주세요.

### 8.2 참여환경 안내

권장:

- PC 또는 노트북
- 안정적인 인터넷
- 집중 가능한 장소
- 연구에서 오디오를 사용하는 경우 소리를 들을 수 있는 환경

작성시간 비교가 주요 자료가 되므로 모바일 참여는 기본 제한하거나 관리자 설정으로 허용한다.

### 8.3 영상보안 안내

필수 체크:

- 연구영상을 저장·녹화·캡처·복제·공유하지 않겠습니다.
- 연구목적 외 용도로 영상을 사용하지 않겠습니다.

동의 시각과 동의문 버전을 저장한다.

### 8.4 관찰방법 안내

권장 문구:

> 1. 먼저 영상을 처음부터 끝까지 한 번 시청합니다.
> 2. 첫 시청이 끝나면 관찰기록을 작성합니다.
> 3. 기록하면서 필요하면 영상을 다시 볼 수 있습니다.
> 4. 두 번째 시청부터는 일시정지하거나 필요한 장면을 다시 확인할 수 있습니다.
> 5. 영상에서 실제로 관찰한 내용을 중심으로 평소 관찰기록을 작성하듯 기록해 주세요.
> 6. 충분히 작성했다고 생각되면 제한시간 이전에도 제출할 수 있습니다.

참여자에게 다음 용어와 가설은 노출하지 않는다.

- Precision
- Recall
- Hallucination
- AI와 인간 중 어느 쪽이 더 우수할 것이라는 가설
- 세부 채점기준

---

## 9. 연습영상

본 연구 5편과 별도의 연습영상 1편을 등록한다.

목적:

- 영상 재생법 숙지
- 첫 시청 제한 경험
- 기록창 사용
- 재시청 기능 확인
- 제출 방법 확인

연습영상 데이터는 본 분석자료에서 제외하되 시스템 검증용으로 구분 저장할 수 있다.

---

## 10. 본 관찰 화면

권장 레이아웃:

```text
┌──────────────────────────────────────┐
│ 관찰 2 / 5              남은 시간 03:42 │
├──────────────────────────────────────┤
│                                      │
│               VIDEO                  │
│                                      │
├──────────────────────────────────────┤
│ 관찰한 내용을 기록해 주세요.              │
│                                      │
│ [                                    ]│
│ [           TEXT AREA                ]│
│ [                                    ]│
│                                      │
│                     [기록 제출하기]      │
└──────────────────────────────────────┘
```

참여 화면에는 V01 같은 내부 연구코드 대신 `관찰 2 / 5`만 표시한다.

---

## 11. 첫 시청 규칙

### 11.1 최초 시청

첫 시청에서는:

- 재생속도 1.0x 고정
- seek/timeline 이동 금지
- forward skip 금지
- rewind 금지
- 원칙적으로 pause 금지
- 기록창 비활성화
- 최초 시청을 완료해야 기록 가능

buffering 시간은 별도로 기록한다.

### 11.2 첫 시청 완료 후

활성화:

- 관찰기록 입력
- replay
- pause
- seek / rewind

계속 제한:

- playback speed 변경
- 영상 다운로드

---

## 12. 관찰 제한시간

- 영상 최초 재생이 실제 시작된 순간 Timer 시작
- 최대 **300초**
- 최초 시청시간도 300초에 포함
- 300초 이전 언제든 자발적 제출 가능
- 300초 도달 시 현재까지 저장된 기록 자동제출

제출 유형:

```text
manual
timeout
```

시간 데이터:

```text
started_at
submitted_at
wall_elapsed_seconds
buffering_seconds
effective_elapsed_seconds
```

권장 계산:

```text
effective_elapsed_seconds
= wall_elapsed_seconds - system_detected_buffering_seconds
```

`wall time` 또는 `effective time` 중 어떤 것을 연구 제한시간으로 사용할지는 `study_settings`에서 설정 가능하게 한다.

---

## 13. 자동저장 및 세션 복구

- 텍스트 변경 후 debounce 방식 자동저장
- 권장 3~5초
- 새로고침으로 timer 초기화 금지
- timer 기준시점은 server-side 값 사용
- 재접속 시 미완료 observation 복구
- 제출된 observation은 수정 및 재진입 금지

---

## 14. Interaction Event Logging

각 관찰에서 다음 이벤트를 저장한다.

```text
observation_started
video_first_play_started
video_first_play_completed
video_play
video_pause
video_seek
video_ended
video_buffer_start
video_buffer_end
page_hidden
page_visible
network_offline
network_online
draft_saved
observation_submitted
timeout_submitted
```

공통 필드:

```text
id
observation_id
participant_id
video_id
event_type
event_timestamp
video_current_time_ms
metadata_json
```

연구자가 다음을 사후 복원할 수 있어야 한다.

- 최초 시청시간
- 총 수행시간
- 재생횟수
- pause 횟수
- seek/rewind 횟수
- 페이지 이탈
- buffering 시간
- 제출유형

---

## 15. 기술적 오류 처리

연구자료에 영향을 줄 수 있는 기술이슈:

- 네트워크 단절
- 장시간 buffering
- video playback error
- 브라우저 강제종료
- 장시간 page hidden
- 비정상 timer drift
- 서버 저장 실패

관리자는 기록을 직접 삭제하지 않는다.

```text
invalidated = true
invalidated_reason = "..."
```

기존 기록을 보존한 뒤 새로운 `attempt_number`를 생성한다.

---

## 16. 참여자 기본정보

권장 필드:

```text
participant_code
teaching_experience_years
teaching_experience_months
current_child_age_group
observation_record_frequency
video_observation_experience
generative_ai_experience
```

교사 경력에 따른 차이는 표본 20명을 고려하여 탐색적 분석으로 사용할 수 있도록 원자료를 확보한다.

---

## 17. 기준 관찰자료 Reference Annotation

각 영상에 대해 교사·AI와 독립된 기준 관찰자료를 구축한다.

기준자료는 **영상에서 직접 확인 가능한 행동을 원자적 행동단위(atomic behavioral event)**로 분해한다.

### 17.1 핵심 행동단위

```text
[행위자]
+ [행동]
+ [대상]
+ [신체/도구]
+ [관계]
+ [시간적 순서]
```

### 17.2 기본 원칙

- 한 Event에는 하나의 핵심 행동동사를 기본으로 한다.
- 관찰 사실과 해석을 분리한다.
- `원한다`, `좋아한다`, `배려한다`, `이해한다` 같은 내적 상태 단정은 Reference Event에서 제외한다.
- 시작/종료 시각을 가능한 한 기록한다.
- 문장표현이 아니라 영상 속 행동내용이 기준이 된다.

### 17.3 예시표

| Event | 시간 | 행위자 | 행동 | 대상 | 신체/도구 | 관계 | 시간적 순서 |
|---|---|---|---|---|---|---|---|
| E01 | 00:03–00:05 | 아동 A | 집는다 | 빨간 블록 | 오른손 | 사물 조작 | 최초 행동 |
| E02 | 00:06–00:08 | 아동 A | 바라본다 | 아동 B | 시선 | 또래 주시 | E01 이후 |
| E03 | 00:09–00:11 | 아동 B | 바라본다 | 빨간 블록 | 시선 | A의 물체에 주의 | E02 직후 |
| E04 | 00:12–00:14 | 아동 A | 내려놓는다 | 빨간 블록 | 오른손 | B 가까이에 배치 | E03 이후 |
| E05 | 00:15–00:17 | 아동 B | 집는다 | 빨간 블록 | 왼손 | A가 놓은 사물 조작 | E04 직후 |

### 17.4 권장 DB 필드

```text
reference_event_id
video_id
event_order
start_ms
end_ms
actor
action
object
body_part_or_tool
relation
previous_event_id
temporal_relation
reference_sentence
notes
coder_id
created_at
updated_at
```

---

## 18. Reference Annotation 코더 구조

권장 연구운영:

- 독립 코더 2명 이상
- 불일치 시 제3 코더 또는 연구책임자 조정
- 코더별 원자료를 보존하고 consensus reference를 별도로 생성

향후 확장을 고려한 데이터 구조:

```text
reference_event_candidates
reference_event_codings
reference_events_consensus
```

MVP에서는 관리자 1인이 최종 Reference Event를 입력하는 기능만 구현하고, 코더별 신뢰도 기능은 Phase 2로 둘 수 있다.

---

## 19. 교사 및 AI 기술문의 Claim Coding

자유서술형 기술문을 의미 단위 Claim으로 분리하고 Reference Event와 대응시킨다.

권장 필드:

```text
claim_id
source_type              # teacher | ai
source_record_id
claim_order
claim_text
matched_reference_event_id
support_type
actor_accuracy
action_accuracy
object_accuracy
temporal_accuracy
granularity_score
coder_id
notes
```

`support_type` 권장값:

```text
observed
inference_supported
inference_unsupported
hallucination
unclear
```

원문 관찰기록은 절대 수정하지 않고 coding layer를 별도로 추가한다.

---

## 20. 관찰과 해석 구분

관찰 예:

```text
아동 A가 교사를 바라본다.
아동 A가 오른손으로 블록을 집는다.
```

해석 예:

```text
아동 A가 교사의 도움을 원한다.
아동 A가 친구에게 양보하려고 한다.
```

해석적 진술을 곧바로 오류로 취급하지 않고 별도의 `Inference` 범주로 분석한다.

---

## 21. AI 기술문 관리

참여교사에게 AI 결과를 노출하지 않는다.

### 21.1 MVP 권장

관리자가 Gemini 등에서 별도로 생성한 기술문을 수동 등록 또는 CSV import한다.

장점:

- 연구웹앱이 영유아 영상을 외부 AI API로 자동 전송하지 않음
- 모델·프롬프트·실행조건을 연구자가 직접 통제
- 개인정보·연구윤리 검토 단순화
- 개발범위 축소

### 21.2 저장 필드

```text
ai_run_id
video_id
run_number
provider
model_name
model_version_or_snapshot
prompt_version_id
prompt_text_snapshot
generated_text
generated_at
generation_settings_json
notes
```

### 21.3 반복 생성

기본 권장값:

```text
AI runs per video = 3
```

필요하면 5회까지 설정 가능.

AI 반복 생성 결과는 독립된 인간 참가자처럼 취급하지 않고 **모델 출력 변동성 확인용**으로 저장한다.

---

## 22. AI Prompt Version 관리

프롬프트를 코드에 hard coding하지 않는다.

테이블:

```text
ai_prompts
```

필드:

```text
id
prompt_code
version
prompt_text
active
created_at
notes
```

각 AI 결과에 사용한 prompt version을 반드시 연결한다.

---

## 23. 핵심 연구 평가지표

Reference Coding 기반으로 다음 지표를 산출할 수 있게 한다.

### Recall

```text
포착한 기준행동 수 / 전체 기준행동 수
```

### Precision

```text
영상에 의해 지지되는 사실적 기술 수 / 전체 사실적 기술 수
```

### F1

```text
2 × Precision × Recall / (Precision + Recall)
```

### Omission Rate

```text
누락 기준행동 수 / 전체 기준행동 수
```

### Hallucination Rate

영상으로 확인되지 않는 사실적 기술의 비율.

### Inference Rate

전체 Claim 중 해석·추론적 진술의 비율.

### Temporal Fidelity

- 행동 순서 정확성
- 이전/이후 관계
- 동시행동 관계
- 반복·전환 기술 정확성

### Actor–Action–Object Accuracy

- 행위자
- 행동
- 대상

연결 정확성.

### Granularity

예시:

```text
1 = 포괄적
"장난감을 가지고 논다."

2 = 중간
"자동차를 손으로 움직인다."

3 = 구체적
"오른손으로 자동차를 잡고 검지로 바퀴를 돌린다."
```

---

## 24. Human Detection Rate

20명 전원이 동일한 영상을 평가하는 설계의 핵심 분석항목이다.

```text
Human Detection Rate
= 해당 Reference Event를 기술한 교사 수 / 20
```

예:

```text
E01: 19/20 = 95%
E02: 12/20 = 60%
E03: 5/20  = 25%
```

관리자 분석화면에서는 Reference Event별로 다음을 확인할 수 있게 한다.

- Human Detection Rate
- AI detected / not detected
- 영상 코드
- 행동 유형

이를 통해 다음을 구분할 수 있다.

- 대부분의 교사가 포착하지만 AI가 놓친 행동
- 교사도 잘 포착하지 못하지만 AI가 포착한 행동
- 인간과 AI 모두 쉽게 포착하는 행동
- 인간과 AI 모두 놓치기 쉬운 행동

---

## 25. 관리자 Dashboard

경로 예:

```text
/admin
```

상단 KPI:

- 등록 참여자 `20 / 20`
- 완료 참여자 수
- 진행 중
- 미시작
- 유효 교사 기록 `100 / 100`
- 기술적 오류 기록 수
- AI 기술문 등록 현황
- Reference Annotation 완료 영상 수

영상별 진행률 예:

| 영상 | 유효 교사기록 | 목표 |
|---|---:|---:|
| V01 | 20 | 20 |
| V02 | 20 | 20 |
| V03 | 19 | 20 |
| V04 | 20 | 20 |
| V05 | 20 | 20 |

---

## 26. 참여자 관리

경로:

```text
/admin/participants
```

표 예:

| Code | Order Group | Status | 완료 | 평균시간 | 마지막 접속 |
|---|---|---|---:|---:|---|
| T01 | O1 | completed | 5/5 | 216초 | ... |
| T02 | O3 | in_progress | 3/5 | 241초 | ... |

상태값:

```text
invited
consented
onboarding
practice_completed
in_progress
completed
withdrawn
technical_issue
```

관리자 기능:

- 참여자 생성
- PIN 재설정
- Order Group 배정
- 진행상태 확인
- observation 무효화
- 재시도 생성
- 연구 중단 처리

---

## 27. 순서그룹 관리

경로:

```text
/admin/order-groups
```

표:

| 그룹 | 순서 | 배정/목표 |
|---|---|---:|
| O1 | 1-2-3-4-5 | 4/4 |
| O2 | 2-3-4-5-1 | 4/4 |
| O3 | 3-4-5-1-2 | 4/4 |
| O4 | 4-5-1-2-3 | 4/4 |
| O5 | 5-1-2-3-4 | 4/4 |

Validation:

```text
각 participant = 5 videos PASS
각 video = 20 assignments PASS
각 video × position = 4 occurrences PASS
각 order group = 4 valid participants PASS
```

---

## 28. 영상 관리 및 보안

경로:

```text
/admin/videos
```

영상 필드:

```text
id
study_id
code
title_admin
storage_path
duration_ms
width
height
has_audio
activity_type
complexity_level
actor_count
object_count
description_admin
active
created_at
updated_at
```

### 영상 보안 원칙

- Private Storage 필수
- public bucket 사용 금지
- 짧은 유효기간의 signed URL 사용
- server-side authorization 후 URL 발급
- 현재 참여자에게 현재 observation 영상만 접근 허용
- 연구 완료 후 영상 접근 금지
- 다운로드 버튼 제거
- direct public URL 생성 금지

선택적으로 영상 위에 `연구참여용 T07` 형식의 워터마크를 표시할 수 있다.

---

## 29. 관찰기록 조회

경로:

```text
/admin/observations
```

필터:

- participant
- video
- order_group
- presentation_order
- manual / timeout
- valid / invalid
- technical_issue

테이블 예:

| Participant | Video | Order | Time | Replay | Pause | Seek | Status |
|---|---|---:|---:|---:|---:|---:|---|

상세화면:

- 영상
- 교사 원문
- 시작/제출시간
- wall/effective time
- first-watch duration
- replay count
- pause count
- seek count
- buffering
- page visibility events
- submission type
- invalidation status

---

## 30. Reference Annotation 관리 화면

경로:

```text
/admin/reference
```

기능:

- 영상별 Event 목록
- start/end time 입력
- actor/action/object/body-part/tool/relation 입력
- temporal relation 입력
- 기준 행동문 작성
- Event 순서 변경
- CSV import/export

권장 UI:

```text
VIDEO PLAYER
────────────────────────
Reference Events
E01 03.2–04.8 A | 집는다 | 빨간 블록 | 오른손
E02 06.1–07.4 A | 바라본다 | B | 시선
...

[+ Add Event]
```

---

## 31. Claim Coding Workspace

경로:

```text
/admin/coding
```

레이아웃:

```text
┌──────────────── Video ────────────────┐
└───────────────────────────────────────┘

Reference Events
────────────────────────────────────────

Teacher or AI Text
────────────────────────────────────────

Claim List / Coding
────────────────────────────────────────
```

기능:

- 기술문을 Claim으로 분할
- Claim과 Reference Event 연결
- support_type 선택
- actor/action/object 정확성
- temporal accuracy
- granularity
- coder note

원문 텍스트는 수정하지 않는다.

---

## 32. 관리자 분석화면

경로:

```text
/admin/analysis
```

### 32.1 원자료 기반 즉시 산출

- 참여자별 평균 작성시간
- 영상별 평균 작성시간
- 제시순서별 평균 작성시간
- 글자 수
- 단어 수
- 문장 수
- replay 횟수
- pause 횟수
- seek 횟수
- timeout 비율

### 32.2 Coding 완료 후 산출

- Teacher Precision
- Teacher Recall
- Teacher F1
- Teacher Omission
- Teacher Inference
- Teacher Temporal Fidelity
- AI Precision
- AI Recall
- AI F1
- AI Hallucination
- AI Inference
- AI Temporal Fidelity
- Human Detection Rate

필터:

- 전체
- 영상별
- 교사별
- 제시순서별
- Reference Event별
- AI Run별

---

## 33. 통계분석 관련 시스템 원칙

웹사이트는 연구자가 원자료를 정확히 확보하고 탐색할 수 있도록 지원하되 **복잡한 추론통계 결과를 자동 연구결론처럼 제시하지 않는다.**

시스템 책임:

1. 원자료 수집
2. 반복측정 구조 보존
3. 연구 코딩
4. 기술통계
5. 분석용 tidy dataset export

최종 통계분석은 R, Python, SPSS 등에서 수행한다.

분석용 데이터에는 반드시 다음 식별변수가 포함되어야 한다.

```text
participant_code
video_code
order_group
presentation_order
observation_id
```

이를 통해 예를 들어 다음 분석을 수행할 수 있어야 한다.

```text
Outcome ~ Video + Order + (1 | Teacher)
```

---

## 34. 데이터 Export

경로:

```text
/admin/exports
```

필수 Export:

```text
participants.csv
participant_demographics.csv
videos.csv
order_groups.csv
assignments.csv
teacher_observations.csv
interaction_events.csv
ai_outputs.csv
reference_events.csv
response_claims.csv
claim_codings.csv
analysis_summary.csv
codebook.csv
```

추가 Master Dataset:

```text
research_master.csv
```

1 row = 1 teacher × video observation.

필드 예:

```text
participant_code
order_group
video_code
presentation_order
started_at
submitted_at
wall_elapsed_seconds
effective_elapsed_seconds
first_watch_seconds
buffering_seconds
replay_count
pause_count
seek_count
submission_type
observation_text
character_count
word_count
sentence_count
device_category
browser_category
technical_issue
invalidated
invalidated_reason
```

가능하면 XLSX export도 제공한다.

---

## 35. 핵심 DB 구조

```text
studies
study_settings
admin_users
audit_logs
participants
participant_demographics
participant_consents
videos
order_groups
order_group_items
participant_order_assignments
observations
observation_events
ai_prompts
ai_runs
reference_events
reference_coder_records
response_claims
claim_codings
coding_sessions
```

---

## 36. observations 테이블

```text
id UUID PK
study_id
participant_id
video_id
order_group_id
presentation_order
attempt_number
status
started_at
first_watch_completed_at
submitted_at
wall_elapsed_seconds
effective_elapsed_seconds
buffering_seconds
replay_count
pause_count
seek_count
observation_text
submission_type
timed_out
technical_issue
invalidated
invalidated_reason
created_at
updated_at
```

---

## 37. study_settings

연구조건을 UI 코드에 magic constant로 분산시키지 않는다.

```text
participant_target = 20
research_video_count = 5
participant_video_count = 5
max_observation_seconds = 300
first_watch_seek_enabled = false
first_watch_pause_enabled = false
first_watch_text_enabled = false
replay_enabled = true
playback_rate = 1.0
practice_video_id = ...
ai_runs_per_video = 3
mobile_allowed = false
timer_mode = effective_time
```

본 연구 시작 이후 주요 설정 변경 시 audit log 필수.

---

## 38. 연구상태

```text
draft
pilot
ready
active
paused
closed
archived
```

`active` 상태에서만 신규 참여 가능.

---

## 39. 관리자 Audit Log

다음 주요 행위를 기록한다.

```text
study_setting_changed
video_uploaded
video_replaced
participant_created
participant_order_group_assigned
participant_reset
observation_invalidated
observation_retry_created
reference_event_created
reference_event_updated
reference_event_deleted
ai_prompt_created
ai_run_created
data_exported
```

필드:

```text
admin_id
action
target_type
target_id
before_json
after_json
created_at
```

---

## 40. UI/UX 디자인 방향

참여자 화면:

- 시험처럼 위압적으로 보이지 않게 구성
- 차분하고 친절한 톤
- 높은 가독성
- 한 화면에서 해야 할 행동을 하나로 제한
- 전문 연구용어 최소화

예:

```text
X Trial 03
O 세 번째 관찰

X Submit response
O 기록 제출하기
```

관리자 화면:

- 화려한 시각화보다 데이터 상태 확인 우선
- 연구 진행률과 오류상태를 10초 이내 파악
- raw data 접근과 필터가 쉬워야 함

---

## 41. 접근성

- 충분한 글자 크기
- 명확한 focus indicator
- keyboard navigation
- timer 경고를 색상만으로 표현하지 않음
- 오류메시지를 텍스트로 제공
- 자동저장 상태 표시

---

## 42. 개인정보 및 보안

최우선 비기능 요구사항.

### 영상

- Private Storage
- signed URL
- server-side authorization
- public caching 최소화

### 참여자

- 연구용 코드 중심
- 실명 최소수집
- 직접식별정보와 연구데이터 분리

### 관리자

- 별도 강한 인증
- 주요 action audit log

### API Key

- server-side environment variable
- client bundle 포함 금지

### 데이터

- 제출된 원자료 overwrite 금지
- 무효화는 flag 방식
- 주기적 백업 정책 고려

### 외부 AI

연구윤리 및 데이터 처리방침 확인 없이 연구 영상을 자동으로 제3자 AI API에 전송하지 않는다.

---

## 43. 하지 말아야 할 것

- 기존 10영상 incomplete-crossed 배정 로직 사용
- 참여자별 서로 다른 5편 배정
- 참여자 자유 회원가입
- 공개 영상 URL
- 참여자에게 AI 결과 또는 Reference Annotation 노출
- 제출 후 기록 수정
- 제출된 원자료 삭제
- 연구가설·평가지표를 온보딩에서 과도하게 설명
- 관리자 수정으로 raw observation 덮어쓰기
- 교사 100개 기록을 100명의 독립표본처럼 취급하는 통계표현
- AI 반복생성 결과를 독립된 인간 표본처럼 취급
- 불필요한 제3자 분석/추적 스크립트 기본 설치

---

## 44. 권장 기술 Stack

```text
Frontend / Full-stack:
Next.js App Router + TypeScript

UI:
Tailwind CSS
shadcn/ui 또는 동급 단순 UI component

Database / Auth / Storage:
Supabase
- PostgreSQL
- Auth
- Private Storage
- Row Level Security

Validation:
Zod

Deployment:
Vercel 또는 동급 Node hosting
```

특정 라이브러리 버전은 개발시점의 안정 버전을 사용한다.

---

## 45. 권장 Application Structure

```text
/app

  /(participant)
    /enter
    /welcome
    /consent
    /profile
    /guide
    /practice
    /study
    /study/[observationId]
    /complete

  /admin
    /dashboard
    /participants
    /videos
    /order-groups
    /observations
    /ai
    /reference
    /coding
    /analysis
    /exports
    /settings

  /api
    /participant
    /observations
    /events
    /videos
    /admin
    /exports

/components
/lib
/types
/db
/scripts
/tests
```

---

## 46. Seed Data

파일 예:

```text
scripts/seed-study.ts
```

생성:

- Study 1개
- V01~V05 연구영상 placeholder
- Practice video placeholder
- O1~O5 order group
- 각 group의 영상순서
- 기본 study settings
- Prompt V1 placeholder

Validation:

```text
Research videos: 5 PASS
Videos per participant: 5 PASS
Order groups: 5 PASS
Target participants per group: 4 PASS
Occurrences per video per position: 4 PASS
```

---

## 47. 자동 테스트 요구사항

### Order Tests

- 각 order group에 V01~V05가 정확히 한 번씩 존재
- 각 영상은 각 position에 한 번씩 존재
- 20명 배정 완료 시 각 video × position = 총 4회
- 각 order group 목표 유효 참여자 = 4명

### Timer Tests

- 300초 제한
- refresh 후 초기화 금지
- timeout autosubmit
- manual submit 가능
- buffering 처리 검증

### Playback Tests

첫 시청:

- seek 금지
- replay 금지
- speed 변경 금지
- text 입력 금지

첫 시청 후:

- replay 가능
- pause 가능
- seek 가능
- speed = 1.0 고정

### Security Tests

- 다른 participant observation 접근 불가
- 연구 종료 후 영상 접근 불가
- signed URL 만료
- public storage URL 없음

### Data Integrity Tests

- 제출 observation 수정 불가
- 관리자 reset이 기존 기록 삭제하지 않음
- invalidation 후 새 attempt 생성
- AI 결과 변경 시 이전 run 보존
- Reference Event 변경 audit 가능

---

## 48. MVP 범위

### Participant

필수:

- 인증
- 환영 및 동의
- 기본정보
- 연구안내
- 연습영상
- 동일 영상 5편 관찰
- 균형화된 제시순서
- 첫 시청 제한
- 5분 timer
- 재시청
- 자동저장
- 제출
- 세션 복구
- 완료화면

### Admin

필수:

- 인증
- Dashboard
- 영상 5편 관리
- 참여자 20명 관리
- order group 관리
- 진행률
- 원문 관찰기록
- interaction log
- 기술오류 처리
- CSV/XLSX export
- audit log

### 보안

필수:

- Private Storage
- server-side authorization
- participant isolation
- signed video access

---

## 49. Phase 2

- AI Prompt Version 관리
- AI 기술문 import
- AI 반복 Run 관리
- Reference Annotation UI
- Claim Coding
- Precision / Recall / F1
- Omission
- Hallucination
- Inference
- Temporal Fidelity
- Granularity
- Human Detection Rate
- 분석 Dashboard

---

## 50. Phase 3 선택사항

- 복수 Study
- 다기관 연구
- 100명 이상 참여자
- Research Coder 별도 Role
- coder 간 reliability 계산
- Gemini 외 복수 AI 모델 비교
- 타임라인 기반 영상 annotation
- R/Python 분석 스크립트 자동생성
- SPSS용 export

---

## 51. 연구 완료 조건

관리자 Dashboard에서 다음 조건을 모두 만족하면:

```text
DATA COLLECTION COMPLETE
```

표시.

```text
20 valid completed participants
AND
100 valid teacher observations
AND
each of 5 videos has 20 valid teacher observations
AND
each of 5 order groups has 4 valid participants
```

---

## 52. 참여자 완료 화면

권장 문구:

> 모든 관찰을 완료했습니다.
>
> 연구에 참여해 주셔서 감사합니다.
>
> 선생님께서 작성해 주신 관찰기록은 영유아 관찰과 인공지능 기술의 가능성을 연구하기 위한 자료로 활용됩니다.
>
> 연구영상과 연구 과정에서 확인한 내용은 외부에 공유하지 말아 주세요.
>
> 이제 창을 닫으셔도 됩니다.

---

## 53. 관리자 첫 화면의 핵심 질문

관리자는 Dashboard를 열고 10초 이내에 다음 질문에 답할 수 있어야 한다.

1. 현재 몇 명이 시작했는가?
2. 몇 명이 완료했는가?
3. 100개 목표 기록 중 몇 개가 유효한가?
4. 각 영상에 20개 유효 기록이 확보되었는가?
5. 각 order group에 4명의 유효 참여자가 있는가?
6. 기술적 오류가 발생한 참여자는 누구인가?
7. Reference Annotation은 어느 영상까지 완료되었는가?
8. AI 기술문은 어느 영상까지 등록되었는가?

---

## 54. CLAUDE.md 최상위 개발 원칙

프로젝트 root에 `CLAUDE.md`를 만들고 다음 내용을 포함한다.

```text
This application is a research-grade data collection system.

Research validity, data integrity, and child-video privacy are more important
than UI convenience or implementation shortcuts.

FINAL STUDY DESIGN:
- 20 childcare teachers
- exactly 5 research videos
- every teacher watches all 5 videos
- 100 teacher observation records total
- 5 balanced presentation-order groups
- 4 valid participants per order group

Never reintroduce the previous 10-video incomplete-crossed design.

Never change experimental timing, presentation order,
first-viewing restrictions, event logging, or submitted research data
without explicit instruction.

For each research video:
1. preload before first playback,
2. start the timer at actual first playback,
3. require one uninterrupted first viewing,
4. disable seeking, replay, and speed changes on first viewing,
5. keep the text area disabled until first viewing completes,
6. then allow replay, pause, and seeking,
7. keep playback speed fixed at 1.0,
8. allow a maximum of 300 seconds,
9. allow early manual submission,
10. autosubmit the saved response at timeout,
11. preserve all raw interaction events.

Never reset an experimental timer because of browser refresh.
Never overwrite or delete submitted raw research records.
Invalid records must be flagged and replaced with a new attempt.
Never expose child observation videos via public URLs.

Participant-facing screens must not expose:
- AI outputs,
- reference annotations,
- research hypotheses,
- scoring metrics.

The reference annotation unit is:
[Actor]
+ [Action]
+ [Object/Target]
+ [Body part or Tool]
+ [Relation]
+ [Temporal order]

Keep raw teacher text, AI text, reference annotations,
and research coding as separate immutable or auditable layers.

The web application should prepare tidy datasets for later statistical analysis.
Do not present inferential statistics as automated research conclusions.

Prioritize:
research validity
→ data integrity
→ privacy
→ usability
→ visual polish.
```

---

## 55. Claude Code 초기 개발 프롬프트

아래 내용을 Claude Code의 최초 프로젝트 지시문으로 사용할 수 있다.

```text
Build the application described in this PRD as a research-grade web application,
not a generic survey app.

Use the FINAL study design only:

- 20 childcare teacher participants
- exactly 5 research videos
- all 20 teachers watch all 5 videos
- 5 observation records per teacher
- 20 teacher records per video
- exactly 100 valid teacher observation records total

Use five balanced cyclic presentation-order groups:

O1: V01 V02 V03 V04 V05
O2: V02 V03 V04 V05 V01
O3: V03 V04 V05 V01 V02
O4: V04 V05 V01 V02 V03
O5: V05 V01 V02 V03 V04

Assign 4 valid participants to each order group.

For each observation:
- preload the assigned video,
- start the experiment timer when actual first playback starts,
- require one uninterrupted first viewing,
- disable seeking, replay, speed changes, and text entry during first viewing,
- unlock text entry after the first viewing,
- allow replay, pause, and seeking after first viewing,
- keep playback speed fixed at 1.0,
- enforce a maximum of 300 seconds,
- allow early manual submission,
- autosubmit saved text at timeout,
- autosave text,
- preserve all interaction events,
- never reset the timer after refresh,
- never overwrite a submitted response.

Use private video storage and server-side authorization.
Never expose child videos using public URLs.

Create separate data layers for:
1. raw teacher observation text,
2. AI generated observation text,
3. reference behavioral events,
4. claim-level research coding.

Reference behavioral events must support:
Actor
Action
Object/Target
Body part or Tool
Relation
Temporal order
Start/end timestamp

Build admin tools for:
- participant progress,
- balanced order assignment,
- video management,
- raw teacher records,
- interaction logs,
- AI text management,
- reference annotations,
- claim coding,
- Human Detection Rate,
- research-data export.

Do not treat the 100 records as 100 independent participants.
Preserve participant_id, video_id, order_group,
and presentation_order in all analysis-ready exports.

The intended downstream statistical structure is approximately:
Outcome ~ Video + Order + (1 | Teacher)

where Teacher is a repeated-measures random effect
and the five purposefully selected videos are initially modeled as fixed factors.

Prioritize research validity and raw-data integrity over convenience.
```

---

## 56. Definition of Done

MVP 완료는 아래 E2E 흐름이 실제로 통과하는 것을 의미한다.

### 관리자

1. Admin 로그인
2. 연구 설정 확인
3. 연습영상 1편 등록
4. 본 영상 V01~V05 등록
5. O1~O5 제시순서 확인
6. 참여자 T01~T20 등록
7. 각 order group 4명씩 배정
8. balance validation PASS 확인

### 참여자

9. 개인링크 접속
10. 인증
11. 안내 및 동의
12. 기본정보 입력
13. 연습영상 완료
14. 배정순서에 따라 본 영상 5편 관찰
15. 첫 시청 제한 정상작동
16. 첫 시청 후 기록 및 재시청 정상작동
17. 300초 timer 정상작동
18. 자동저장 정상작동
19. 5건 제출
20. 완료화면 표시

### 연구자

21. Dashboard에서 100건 수집상태 확인
22. 영상별 20건 확인
23. order group별 4명 확인
24. 교사 원문 확인
25. interaction log 확인
26. invalidation/retry 정상작동
27. CSV/XLSX export
28. export 데이터만으로 참여자 × 영상 × 제시순서 × 수행시간 × 기록원문 재구성 가능

### Phase 2 연구분석

29. AI text 등록
30. Reference Event 등록
31. Claim Coding
32. Human Detection Rate 확인
33. Precision/Recall/F1 등 기술통계 확인
34. 코딩 데이터를 분석용 파일로 export

---

## 57. 최우선 개발 판단

이 프로젝트의 성공기준은 화려한 UI가 아니다.

우선순위는 다음과 같다.

1. **20명 전원이 동일한 5편을 관찰하고 제시순서만 균형화되는가**
2. **모든 참여자에게 동일한 실험조건이 적용되는가**
3. **100건의 교사 관찰기록과 수행과정을 손실 없이 보존하는가**
4. **기준 관찰자료를 행동단위로 구조화할 수 있는가**
5. **AI·교사·Reference 자료를 서로 섞지 않고 독립 레이어로 보존하는가**
6. **나중에 mixed-effects model 등 다양한 통계분석이 가능하도록 원자료를 export할 수 있는가**
7. **영유아 영상이 연구 참여자 이외에 노출되지 않는가**

개발 편의를 이유로 위 연구조건을 임의로 완화하거나 변경해서는 안 된다.
