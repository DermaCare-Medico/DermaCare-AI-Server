
export class ApiResponse<T> {
  constructor(
    public readonly statusCode: number,
    public readonly message: string,
    public readonly data: T,
    public readonly meta?: Record<string, unknown>,
  ) {}
}

/* 
## API response could look like this:
{
  "statusCode": 200,
  "message": "Doctors fetched successfully",
  "data": [
    {
      "id": "doctor-123",
      "name": "Example Doctor"
    }
  ]
}
*/ 