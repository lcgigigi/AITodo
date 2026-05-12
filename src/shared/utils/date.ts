import dayjs from 'dayjs'

export const formatDate = (value: string | number | Date, pattern = 'YYYY-MM-DD') =>
  dayjs(value).format(pattern)

export const formatDateTime = (value: string | number | Date) =>
  dayjs(value).format('YYYY-MM-DD HH:mm')
