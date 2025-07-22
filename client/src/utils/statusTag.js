import { Tag } from 'antd';

const statusTag = (status) => {
    let color, text;
    switch (status) {
        case 'pending':
            color = 'gold';
            text = '待分配';
            break;
        case 'assigned':
            color = 'green';
            text = '已分配';
            break;
        case 'expired':
            color = 'red';
            text = '已過期';
            break;
        case 'approved':
            color = 'blue';
            text = '已批准';
            break;
        default:
            color = 'default';
            text = status || '未知';
    }
    return (
        <Tag
            color={color}
            style={{
                borderRadius: '12px',
                padding: '2px 12px',
                fontWeight: 'bold',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}
        >
            {text}
        </Tag>
    );
};

export default statusTag;