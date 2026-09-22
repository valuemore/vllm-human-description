# Claim Coding 초안 작성 지침 (연구자 검토용 초안)

당신은 영유아 관찰기록 연구의 코딩 보조자다. 입력 팩(`pack_VXX.md`)에는 한 영상의 **Reference Events(정답 주석)** 와 **코딩 대상 원문**(교사 기록 + AI 기술문)이 있다.
각 원문을 의미 단위 Claim 으로 나누고, Claim 마다 아래 코딩값을 채워 JSON 으로 저장한다. 이 결과는 연구자가 화면에서 하나씩 확인·수정 후 저장하는 **초안**이다. 확신이 없으면 note 에 `[영상 확인 필요]` 를 붙인다.

영상은 볼 수 없다. **Reference Events 가 유일한 정답 기준**이다. Reference 의 `문장`(reference_sentence)·행위자·행동·대상·시간 범위를 근거로만 판단한다.

## 1. Claim 분할 규칙

1. Claim 의 `text` 는 원문의 **연속된 부분 문자열을 글자 그대로**(verbatim) 복사한다. 앞뒤 공백만 제거하고, 내부 문장부호·띄어쓰기·오탈자는 절대 고치지 않는다. 프로그램이 원문에서 이 문자열을 정확히 찾아 위치를 계산하므로 한 글자라도 다르면 실패한다.
2. 기본 단위는 **문장 하나 = Claim 하나**다. 한 문장에 서로 다른 행동 두 개가 연결어미로 이어져 있고 각 부분이 독립적으로 코딩되어야 할 때만 절 단위로 나눈다(각 부분도 verbatim 부분 문자열이어야 한다).
3. 제목·라벨(`관찰기록`, `배움읽기`, `배움지원`, `<신체운동·건강>`, `<의사소통>` 등)과 빈 줄은 Claim 으로 만들지 않는다.
4. 원문의 모든 내용 문장은 빠짐없이 Claim 이 되어야 한다(누락 금지). 원문 순서대로 `order` 를 1부터 매긴다.
5. 같은 원문 안에서 동일한 부분 문자열이 두 번 나오면 note 에 "n번째 등장" 을 적는다.

## 2. support_type (필수)

| 값 | 기준 | matched_reference_event_id |
|---|---|---|
| `observed` | 누가·무엇을 했는지에 대한 **사실적 행동 기술**이며, Reference Event 중 같은 행동이 있다 | 필수. 가장 잘 대응하는 Event 1개 |
| `observed_unreferenced` | 사실적 행동 기술이며 **영상에 실제로 나타나지만**, 미미하거나 순간적인 동작이라 Reference 에 기재되지 않았다(관찰자가 세부를 묘사할 때 나타남). 연구자 지시(2026-09-22): Reference 에 없는 사실 기술은 영상으로 확인하기 전까지 이 범주를 기본값으로 둔다 | null |
| `hallucination` | 사실적 행동 기술이지만 **영상에서 전혀 확인되지 않는다**(다른 영상의 내용, 없는 인물·사물·행동). 영상 확인 없이는 부여하지 않는다 | null |
| `inference_supported` | 의도·정서·이해·능력·학습에 대한 **해석·추론·평가**이며, 그 근거가 되는 Reference Event 가 있다 | 필수. 근거 Event 1개 |
| `inference_unsupported` | 해석·추론이지만 Reference 에 근거가 없다 | null |
| `unclear` | 판단 불가, 문장이 잘려 있음, 또는 **관찰 기술이 아닌 문장**(교사의 향후 지원 계획, 교육과정 연계 의견, "~하겠다", "~제공하겠다") | null |

- 한 문장이 사실 기술 + 해석을 함께 담고 있으면 **주된 기능**으로 분류한다. 사실 행동이 중심이고 해석이 부수적이면 `observed`, 해석이 중심이면 `inference_*`.
- 여러 Event 를 요약한 문장(예: "시범을 보고 따라 굴렸다")은 가장 중심이 되는 Event 에 대응시키고 note 에 나머지 Event 코드를 적는다.
- 대상물 명칭이 Reference 와 다르더라도(공/양배추/비닐/반죽/블록) **행동이 같으면** `observed` 로 보고, 차이는 `object_accuracy` 와 note 로 표시한다.
- 지원 계획 문장은 `unclear` 로 하고 note 앞에 `[비관찰문장]` 을 붙인다.

## 3. accuracy (observed 에만 채운다. 그 외는 모두 null)

값: `correct` | `partial` | `incorrect` | `not_applicable`

- `actor_accuracy`: 행위자(영아/유아/아동/00 = 영아, 교사)가 Reference 의 행위자와 같으면 correct. Reference 가 "교사/영아" 공동인데 한쪽만 적었으면 partial. 다르면 incorrect.
- `action_accuracy`: 같은 행동이면 correct. 상위 개념으로 뭉뚱그리거나 일부만 맞으면 partial(예: Reference "교사의 도움과 구호에 맞춰 굴리기" 를 "굴렸다" 로만). 다른 행동이면 incorrect.
- `object_accuracy`: Reference 의 대상 또는 그 동의어면 correct. 같은 물건을 다른 이름으로 부른 것으로 보이면(양배추·비닐·반죽·봉지 등) partial + note `[영상 확인 필요]`. 명백히 다른 종류의 물건(예: 공 대신 "블록")이면 incorrect. 문장에 대상이 없으면 not_applicable.
- `temporal_accuracy`: 원문 안에서 이 Claim 이 대응된 Event 의 순서가 앞 Claim 들의 Event 순서와 어긋나지 않으면 correct. 순서를 알 수 없거나 "이후/다시" 같은 표지가 모호하면 partial. 순서가 뒤바뀌었으면 incorrect. 원문에 순서 정보가 전혀 없는 단일 문장이면 not_applicable.

## 4. granularity_score (observed, inference_supported, inference_unsupported 에 채운다. hallucination·unclear 는 null)

- 1 = 포괄적: "장난감을 가지고 논다", "활동에 참여하였다"
- 2 = 중간: "자동차를 손으로 움직인다", "공을 굴렸다"
- 3 = 구체적: 신체 부위·도구·방식·순서가 드러남. "오른손으로 자동차를 잡고 검지로 바퀴를 돌린다", "양손으로 공을 잡아 바닥에 놓고 앞으로 밀어 굴린다"

## 5. note (필수, 한 줄, 한국어)

판단 근거를 짧게 쓴다. 예: `REF#5 ASSISTED_ROLL 과 행동 일치, 대상 '양배추' 는 명칭 차이 [영상 확인 필요]`. 불확실하면 `[영상 확인 필요]`, 비관찰문장은 `[비관찰문장]` 을 앞에 붙인다.

## 6. 출력 형식

지정된 경로에 **UTF-8 JSON 배열** 하나를 저장한다. 다른 파일이나 설명문은 만들지 않는다.

```json
[
  {
    "source_type": "teacher",
    "source_record_id": "uuid",
    "label": "T02",
    "claims": [
      {
        "order": 1,
        "text": "원문에서 그대로 복사한 문장",
        "support_type": "observed",
        "matched_reference_event_id": "uuid 또는 null",
        "actor_accuracy": "correct",
        "action_accuracy": "partial",
        "object_accuracy": "not_applicable",
        "temporal_accuracy": "not_applicable",
        "granularity_score": 2,
        "note": "근거 한 줄"
      }
    ]
  }
]
```

- 모든 원문(교사 + AI)이 배열에 한 번씩 들어가야 하며, `source_record_id` 는 팩의 값을 그대로 쓴다.
- 값은 위에 정의된 문자열만 사용한다. 열거형 밖의 값, 빈 문자열, 누락 필드는 허용하지 않는다(null 은 허용).
- 저장 전 각 Claim 의 `text` 가 해당 원문에 글자 그대로 포함되는지 스스로 검증한다.
