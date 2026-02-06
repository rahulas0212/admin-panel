async function searchMembers() {
const params = new URLSearchParams({
membershipId: membershipId.value,
organizationName: organizationName.value,
primaryMobile: primaryMobile.value,
email: email.value,
status: status.value
});


const res = await fetch('/api/members?' + params.toString());
const data = await res.json();


const container = document.getElementById('results');
container.innerHTML = '';


if (data.length === 0) {
container.innerHTML = '<p>No members found</p>';
return;
}


data.forEach(m => {
const div = document.createElement('div');
div.className = 'result-row';
div.innerHTML = `
<strong>${m.membershipId}</strong><br/>
${m.organizationName}<br/>
Status: ${m.status}<br/>
<button onclick="viewMember('${m._id}')">View / Edit</button>
`;
container.appendChild(div);
});
}


async function viewMember(id) {
const res = await fetch('/api/member/' + id);
const m = await res.json();


modalBody.innerHTML = `
<h3>${m.organizationName}</h3>
<p><b>Membership ID:</b> ${m.membershipId}</p>
<p><b>Status:</b> ${m.status}</p>
<p><b>Mobile:</b> ${m.primaryMobile}</p>
<p><b>Email:</b> ${m.email || '-'}</p>


${m.logo ? `<img src="/${m.logo}" class="preview" />` : ''}
${m.signature ? `<img src="/${m.signature}" class="preview" />` : ''}


<form method="POST" action="/update-member/${m._id}" enctype="multipart/form-data">
<label>Membership End Date</label>
<input type="date" name="endDate" value="${m.endDate ? m.endDate.split('T')[0] : ''}" />


<label>Replace Logo</label>
<input type="file" name="logo" />


<label>Replace Signature</label>
<input type="file" name="signature" />


<button>Update</button>
</form>
`;


document.getElementById('modal').style.display = 'block';
}


function closeModal() {
document.getElementById('modal').style.display = 'none';
}